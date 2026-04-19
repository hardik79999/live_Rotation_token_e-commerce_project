"""
Google OAuth 2.0

Two root causes of the original failure, both fixed here:

1. REDIRECT URL MISMATCH
   url_for(..., _external=True) was generating http://192.168.0.3:7899/...
   because ProxyFix was forwarding the LAN IP.  Google Console only has
   http://localhost:7899/api/auth/google/callback registered, so Google
   rejected the code exchange with redirect_uri_mismatch.

   Fix: build the callback URL manually from GOOGLE_CALLBACK_BASE env var
   (defaults to http://localhost:7899) instead of using url_for.

2. DUPLICATE / QUOTED CREDENTIALS IN .env
   The .env had the real credentials at the bottom with surrounding quotes
   ("...") which python-dotenv includes in the value, causing an audience
   mismatch when verifying the ID token.

   Fix: .env now has a single, clean, unquoted GOOGLE_CLIENT_ID entry.

3. FRONTEND REDIRECT
   The final redirect used FRONTEND_BASE_URL (192.168.0.3:5173).
   Fix: use GOOGLE_FRONTEND_REDIRECT (defaults to http://localhost:5173).
"""
import re
import secrets
from urllib.parse import urlencode

import requests as http_requests
from flask import current_app, redirect, request
from flask_jwt_extended import (
    create_access_token,
    create_refresh_token,
    set_access_cookies,
    set_refresh_cookies,
)
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from google.auth.exceptions import TransportError
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired

from shop.extensions import db
from shop.models import User, Role
from shop.utils.api_response import error_response


# ── Helpers ───────────────────────────────────────────────────

def _state_serializer():
    return URLSafeTimedSerializer(current_app.config['SECRET_KEY'], salt='google-oauth-state')


def _make_state() -> str:
    nonce = secrets.token_hex(16)
    return _state_serializer().dumps(nonce)


def _verify_state(state: str) -> bool:
    try:
        _state_serializer().loads(state, max_age=600)
        return True
    except (BadSignature, SignatureExpired):
        return False


def _callback_url() -> str:
    """
    Build the redirect_uri that EXACTLY matches what is registered in
    Google Console.  Uses GOOGLE_CALLBACK_BASE so it is always localhost
    regardless of what host Flask is actually running on.
    """
    base = current_app.config.get('GOOGLE_CALLBACK_BASE', 'http://localhost:7899').rstrip('/')
    return f'{base}/api/auth/google/callback'


def _frontend_url() -> str:
    return current_app.config.get('GOOGLE_FRONTEND_REDIRECT', 'http://localhost:5173').rstrip('/')


def _safe_username_from_email(email: str) -> str:
    base = re.sub(r'[^a-zA-Z0-9_]', '', email.split('@')[0])[:20] or 'user'
    candidate, counter = base, 1
    while User.query.filter_by(username=candidate).first():
        candidate = f'{base}{counter}'
        counter  += 1
    return candidate


def _issue_jwt_redirect(user: User, frontend: str):
    role_name = user.role.role_name if user.role else 'customer'
    claims    = {'role': role_name, 'user_uuid': user.uuid}
    access_token  = create_access_token(identity=user.uuid, additional_claims=claims)
    refresh_token = create_refresh_token(identity=user.uuid, additional_claims=claims)
    response = redirect(f'{frontend}/auth/google/success')
    set_access_cookies(response, access_token)
    set_refresh_cookies(response, refresh_token)
    return response


# ── Route actions ─────────────────────────────────────────────

def google_login_action():
    client_id = current_app.config.get('GOOGLE_CLIENT_ID', '').strip()
    if not client_id or client_id == 'your-google-client-id.apps.googleusercontent.com':
        current_app.logger.error('Google OAuth: GOOGLE_CLIENT_ID is not set in .env')
        return error_response('Google OAuth is not configured on this server.', 503)

    params = {
        'client_id':     client_id,
        'redirect_uri':  _callback_url(),
        'response_type': 'code',
        'scope':         'openid email profile',
        'state':         _make_state(),
        'access_type':   'online',
        'prompt':        'select_account',
    }
    auth_url = 'https://accounts.google.com/o/oauth2/v2/auth?' + urlencode(params)
    current_app.logger.info(f'Google OAuth: redirecting to Google. callback_url={_callback_url()}')
    return redirect(auth_url)


def google_callback_action():
    frontend  = _frontend_url()
    error_url = f'{frontend}/login?oauth_error='

    # ── CSRF state ────────────────────────────────────────────
    state = request.args.get('state', '')
    if not _verify_state(state):
        current_app.logger.warning('Google OAuth: invalid or expired state token')
        return redirect(error_url + 'invalid_state')

    if request.args.get('error'):
        err = request.args['error']
        current_app.logger.warning(f'Google OAuth: Google returned error={err}')
        return redirect(error_url + err)

    code = request.args.get('code', '')
    if not code:
        current_app.logger.warning('Google OAuth: no authorization code in callback')
        return redirect(error_url + 'no_code')

    client_id     = current_app.config['GOOGLE_CLIENT_ID'].strip().strip('"')
    client_secret = current_app.config['GOOGLE_CLIENT_SECRET'].strip().strip('"')
    callback_uri  = _callback_url()

    current_app.logger.info(
        f'Google OAuth callback — '
        f'client_id={client_id[:20]}... '
        f'callback_uri={callback_uri}'
    )

    # ── Step 1: Exchange authorization code for tokens ────────
    try:
        token_resp = http_requests.post(
            'https://oauth2.googleapis.com/token',
            data={
                'code':          code,
                'client_id':     client_id,
                'client_secret': client_secret,
                'redirect_uri':  callback_uri,
                'grant_type':    'authorization_code',
            },
            timeout=10,
        )

        # Log the raw response so we can see exactly what Google says
        current_app.logger.info(
            f'Google token endpoint HTTP {token_resp.status_code}: '
            f'{token_resp.text[:500]}'
        )

        if not token_resp.ok:
            err_body = token_resp.json() if token_resp.content else {}
            current_app.logger.error(
                f'Google OAuth token exchange FAILED — '
                f'status={token_resp.status_code} '
                f'error={err_body.get("error")} '
                f'description={err_body.get("error_description")} '
                f'redirect_uri_sent={callback_uri}'
            )
            return redirect(error_url + 'token_exchange_failed')

        token_data = token_resp.json()

    except http_requests.exceptions.Timeout:
        current_app.logger.error('Google OAuth: token exchange timed out')
        return redirect(error_url + 'token_exchange_failed')
    except Exception as e:
        current_app.logger.error(f'Google OAuth token exchange exception: {type(e).__name__}: {e}')
        return redirect(error_url + 'token_exchange_failed')

    # ── Step 2: Verify the ID token ───────────────────────────
    raw_id_token = token_data.get('id_token', '')
    if not raw_id_token:
        current_app.logger.error(
            f'Google OAuth: no id_token in response. '
            f'Keys present: {list(token_data.keys())}'
        )
        return redirect(error_url + 'token_verification_failed')

    try:
        id_info = id_token.verify_oauth2_token(
            raw_id_token,
            google_requests.Request(),
            client_id,
            clock_skew_in_seconds=60,   # allow up to 60 s clock drift
        )
        current_app.logger.info(
            f'Google OAuth: ID token verified. '
            f'sub={id_info.get("sub")} '
            f'email={id_info.get("email")} '
            f'aud={id_info.get("aud")}'
        )

    except ValueError as e:
        # Most common: audience mismatch, expired token, wrong issuer
        current_app.logger.error(
            f'Google OAuth ID token ValueError: {e} | '
            f'client_id_used={client_id[:20]}... | '
            f'token_aud={_peek_aud(raw_id_token)}'
        )
        return redirect(error_url + 'token_verification_failed')
    except TransportError as e:
        current_app.logger.error(f'Google OAuth: could not fetch Google public keys: {e}')
        return redirect(error_url + 'token_verification_failed')
    except Exception as e:
        current_app.logger.error(
            f'Google OAuth ID token unexpected error: {type(e).__name__}: {e}'
        )
        return redirect(error_url + 'token_verification_failed')

    google_sub     = id_info['sub']
    email          = id_info.get('email', '').lower().strip()
    name           = id_info.get('name', '')
    picture_url    = id_info.get('picture', '')
    email_verified = id_info.get('email_verified', False)

    if not email or not email_verified:
        current_app.logger.warning(
            f'Google OAuth: email missing or unverified. '
            f'email={email!r} verified={email_verified}'
        )
        return redirect(error_url + 'email_not_verified')

    # ── Step 3: Find or create user ───────────────────────────
    try:
        user = User.query.filter_by(google_id=google_sub).first()

        if not user:
            user = User.query.filter_by(email=email).first()
            if user:
                user.google_id   = google_sub
                user.is_verified = True
                if picture_url and not user.profile_photo:
                    user.profile_photo = picture_url
                db.session.commit()
                current_app.logger.info(f'Google OAuth: linked google_id to {email}')

        if not user:
            customer_role = Role.query.filter_by(role_name='customer').first()
            if not customer_role:
                current_app.logger.error('Google OAuth: customer role not found in DB')
                return redirect(error_url + 'server_error')

            username = _safe_username_from_email(email)
            if name:
                clean = re.sub(r'[^a-zA-Z0-9_]', '', name.replace(' ', '_'))[:20]
                if clean and not User.query.filter_by(username=clean).first():
                    username = clean

            user = User(
                username      = username,
                email         = email,
                password      = None,
                role_id       = customer_role.id,
                is_active     = True,
                is_verified   = True,
                google_id     = google_sub,
                profile_photo = picture_url or None,
            )
            db.session.add(user)
            db.session.commit()
            current_app.logger.info(f'Google OAuth: auto-registered {email} as {username}')

        if not user.is_active:
            return redirect(error_url + 'account_suspended')

        current_app.logger.info(
            f'Google OAuth: issuing JWT for {user.email} → redirecting to {frontend}'
        )
        return _issue_jwt_redirect(user, frontend)

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f'Google OAuth DB error: {type(e).__name__}: {e}')
        return redirect(error_url + 'server_error')


def _peek_aud(raw_token: str) -> str:
    """Decode the audience claim from a JWT without verifying it (for logging only)."""
    try:
        import base64, json
        payload_b64 = raw_token.split('.')[1]
        # Add padding
        payload_b64 += '=' * (4 - len(payload_b64) % 4)
        payload = json.loads(base64.urlsafe_b64decode(payload_b64))
        return str(payload.get('aud', 'unknown'))
    except Exception:
        return 'could_not_decode'
