from flask import request
from flask_jwt_extended import verify_jwt_in_request, get_jwt
from shop.extensions import db
from shop.models import User
from shop.utils.api_response import error_response, success_response


def _serialize_user(user: User) -> dict:
    return {
        "uuid":           user.uuid,
        "username":       user.username,
        "email":          user.email,
        "role":           user.role.role_name,
        "phone":          user.phone,
        "profile_photo":  user.profile_photo,
        "wallet_balance": round(user.wallet_balance or 0.0, 2),
    }


def profile_action():
    """GET /api/auth/profile — return current user's profile."""
    try:
        verify_jwt_in_request()
        user_uuid = get_jwt().get("user_uuid")

        user = User.query.filter_by(uuid=user_uuid, is_active=True).first()
        if not user:
            return error_response("User not found", 404)

        return success_response(
            message="Profile fetched successfully",
            data=_serialize_user(user),
            status_code=200,
        )

    except Exception as e:
        error_msg = str(e)
        if "Signature has expired" in error_msg or "Token has expired" in error_msg:
            return error_response("Session expired. Please login again.", 401)
        return error_response(error_msg, 500)


def update_profile_action():
    """PUT /api/auth/profile — update username and/or phone."""
    try:
        verify_jwt_in_request()
        user_uuid = get_jwt().get("user_uuid")

        user = User.query.filter_by(uuid=user_uuid, is_active=True).first()
        if not user:
            return error_response("User not found", 404)

        data     = request.get_json() or {}
        username = (data.get("username") or "").strip()
        phone    = (data.get("phone")    or "").strip() or None

        if username and username != user.username:
            # Check uniqueness
            if User.query.filter(User.username == username, User.id != user.id).first():
                return error_response("Username already taken", 409)
            user.username = username

        if phone != user.phone:
            if phone and User.query.filter(User.phone == phone, User.id != user.id).first():
                return error_response("Phone number already in use", 409)
            user.phone = phone

        user.updated_by = user.id
        db.session.commit()

        return success_response(
            message="Profile updated successfully",
            data=_serialize_user(user),
            status_code=200,
        )

    except Exception as e:
        db.session.rollback()
        return error_response(str(e), 500)
