/**
 * GoogleAuthSuccess — landing page after Google OAuth callback.
 *
 * The Flask callback sets JWT cookies on the redirect response, so by the
 * time the browser loads this page the cookies are already present.
 * We just call GET /api/auth/profile (which the Axios interceptor handles
 * automatically) to hydrate the Zustand store, then redirect to the dashboard.
 *
 * If the URL contains ?oauth_error=... we show an error toast and redirect
 * to /login instead.
 */
import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authApi } from '@/api/auth';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';

export function GoogleAuthSuccess() {
  const navigate      = useNavigate();
  const [searchParams] = useSearchParams();
  const { setUser }   = useAuthStore();

  useEffect(() => {
    const oauthError = searchParams.get('oauth_error');

    if (oauthError) {
      const messages: Record<string, string> = {
        invalid_state:             'Security check failed. Please try again.',
        token_exchange_failed:     'Could not connect to Google. Please try again.',
        token_verification_failed: 'Google sign-in verification failed.',
        email_not_verified:        'Your Google account email is not verified.',
        account_suspended:         'Your account has been suspended. Contact support.',
        server_error:              'A server error occurred. Please try again.',
        access_denied:             'Google sign-in was cancelled.',
      };
      toast.error(messages[oauthError] ?? 'Google sign-in failed. Please try again.');
      navigate('/login', { replace: true });
      return;
    }

    // Cookies are already set — just fetch the profile to hydrate the store
    authApi.profile()
      .then((res) => {
        const user = res.data.data;
        if (user) {
          setUser(user);
          toast.success(`Welcome, ${user.username}! 🎉`);
          if (user.role === 'admin') {
            navigate('/admin/dashboard', { replace: true });
          } else if (user.role === 'seller') {
            navigate('/seller/dashboard', { replace: true });
          } else {
            navigate('/user/dashboard', { replace: true });
          }
        } else {
          throw new Error('No user data');
        }
      })
      .catch(() => {
        toast.error('Sign-in failed. Please try again.');
        navigate('/login', { replace: true });
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <img
          src="/logo.png"
          alt="ShopHub"
          className="h-16 w-auto object-contain animate-pulse"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-400">Signing you in with Google…</p>
      </div>
    </div>
  );
}
