import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { Mail, Lock } from 'lucide-react';
import { authApi } from '@/api/auth';
import { useAuthStore } from '@/store/authStore';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton';
import toast from 'react-hot-toast';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { setUser } = useAuthStore();
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/';

  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Show toast based on email verification result
  useEffect(() => {
    const v = searchParams.get('verified');
    if (!v) return;
    if (v === 'success')  toast.success('🎉 Email verified! You can now log in.');
    if (v === 'already')  toast('Email already verified. Please log in.', { icon: 'ℹ️' });
    if (v === 'expired')  toast.error('Verification link expired. Please sign up again.');
    if (v === 'invalid')  toast.error('Invalid verification link.');
    if (v === 'notfound') toast.error('Account not found.');
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.email) e.email = 'Email is required';
    if (!form.password) e.password = 'Password is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const res = await authApi.login(form);
      const user = res.data.data;
      if (user) {
        setUser(user);
        toast.success(`Welcome back, ${user.username}!`);

        // If the user was redirected here from a protected route (e.g. by
        // clicking an email link while logged out), send them back there.
        // Otherwise fall back to the role-based default dashboard.
        if (from && from !== '/') {
          navigate(from, { replace: true });
        } else if (user.role === 'admin') {
          navigate('/admin/dashboard', { replace: true });
        } else if (user.role === 'seller') {
          navigate('/seller/dashboard', { replace: true });
        } else {
          navigate('/user/dashboard', { replace: true });
        }
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex flex-col items-center gap-2">
            <img src="/logo.png" alt="ShopHub" className="h-20 w-auto object-contain"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            <span className="text-2xl font-bold text-white">
              Shop<span className="text-orange-400">Hub</span>
            </span>
          </Link>
          <p className="text-gray-400 mt-2 text-sm">Sign in to your account</p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-6">Welcome back</h1>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email"
              type="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              error={errors.email}
              icon={<Mail size={16} />}
              autoComplete="email"
            />
            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              error={errors.password}
              icon={<Lock size={16} />}
              autoComplete="current-password"
            />

            <div className="flex justify-end">
              <Link to="/forgot-password" className="text-sm text-orange-500 hover:text-orange-600">
                Forgot password?
              </Link>
            </div>

            <Button type="submit" loading={loading} size="lg" className="w-full">
              Sign In
            </Button>
          </form>

          {/* ── Divider ── */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-gray-200 dark:bg-slate-600" />
            <span className="text-xs text-gray-400 dark:text-slate-400 font-medium">OR</span>
            <div className="flex-1 h-px bg-gray-200 dark:bg-slate-600" />
          </div>

          {/* ── Google Sign-In ── */}
          <GoogleSignInButton />

          <p className="text-center text-sm text-gray-500 dark:text-slate-400 mt-6">
            Don't have an account?{' '}
            <Link to="/signup" className="text-orange-500 hover:text-orange-600 font-medium">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
