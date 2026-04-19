import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Mail, Phone, Shield, Camera, Pencil, Save, X,
  Trash2, AlertTriangle, Lock, Package, ShoppingBag,
  TrendingUp, Users, CheckCircle, User,
} from 'lucide-react';
import { authApi } from '@/api/auth';
import { orderApi } from '@/api/user';
import { sellerApi } from '@/api/seller';
import { adminApi } from '@/api/admin';
import { useAuthStore } from '@/store/authStore';
import { getImageUrl, formatPrice, formatDate } from '@/utils/image';
import { Badge, orderStatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { PageSpinner } from '@/components/ui/Spinner';
import { ImageCropper } from '@/components/ui/ImageCropper';
import type { Order, AdminDashboard, Product, SellerOrder } from '@/types';
import toast from 'react-hot-toast';
import { cn } from '@/utils/cn';

// ── Avatar ────────────────────────────────────────────────────
function Avatar({ src, name }: { src?: string | null; name: string }) {
  if (src) {
    return (
      <img
        src={getImageUrl(src)}
        alt={name}
        className="w-24 h-24 rounded-full object-cover ring-4 ring-white dark:ring-slate-800 shadow-lg"
      />
    );
  }
  return (
    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center font-bold text-white text-3xl ring-4 ring-white dark:ring-slate-800 shadow-lg">
      {name?.[0]?.toUpperCase() ?? '?'}
    </div>
  );
}

// ── Stat card ─────────────────────────────────────────────────
function StatCard({ label, value, icon, lightBg, darkBg, lightColor, darkColor }: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  lightBg: string;
  darkBg: string;
  lightColor: string;
  darkColor: string;
}) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-4 flex items-center gap-3 shadow-sm">
      <div className={cn('p-2.5 rounded-xl shrink-0', lightBg, darkBg)}>
        <div className={cn(lightColor, darkColor)}>{icon}</div>
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 dark:text-slate-400 truncate">{label}</p>
        <p className="text-lg font-bold text-gray-900 dark:text-slate-100 truncate">{value}</p>
      </div>
    </div>
  );
}

const STAT_CARDS = {
  products:   { lightBg: 'bg-blue-50',   darkBg: 'dark:bg-blue-500/10',   lightColor: 'text-blue-600',   darkColor: 'dark:text-blue-400' },
  orders:     { lightBg: 'bg-orange-50', darkBg: 'dark:bg-orange-500/10', lightColor: 'text-orange-600', darkColor: 'dark:text-orange-400' },
  revenue:    { lightBg: 'bg-green-50',  darkBg: 'dark:bg-green-500/10',  lightColor: 'text-green-600',  darkColor: 'dark:text-green-400' },
  categories: { lightBg: 'bg-purple-50', darkBg: 'dark:bg-purple-500/10', lightColor: 'text-purple-600', darkColor: 'dark:text-purple-400' },
  users:      { lightBg: 'bg-blue-50',   darkBg: 'dark:bg-blue-500/10',   lightColor: 'text-blue-600',   darkColor: 'dark:text-blue-400' },
};

export function ProfilePage() {
  const { user, setUser, updateUser, clearUser } = useAuthStore();
  const navigate = useNavigate();
  const role = user?.role ?? 'customer';

  const [customerOrders, setCustomerOrders] = useState<Order[]>([]);
  const [sellerOrders,   setSellerOrders]   = useState<SellerOrder[]>([]);
  const [sellerProducts, setSellerProducts] = useState<Product[]>([]);
  const [adminStats,     setAdminStats]     = useState<AdminDashboard | null>(null);
  const [loadingData,    setLoadingData]    = useState(true);

  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState({ username: '', phone: '' });
  const [saving,   setSaving]   = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const [cropSrc,        setCropSrc]        = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoPreview,   setPhotoPreview]   = useState<string | null>(null);

  // ── Delete account — uses in-app modal, NOT browser confirm() ──
  const [showDelete, setShowDelete] = useState(false);
  const [deleting,   setDeleting]   = useState(false);

  useEffect(() => {
    authApi.profile().then((r) => { if (r.data.data) setUser(r.data.data); }).catch(() => {});

    const load = async () => {
      try {
        if (role === 'customer') {
          const r = await orderApi.getOrders();
          setCustomerOrders(r.data.data || []);
        } else if (role === 'seller') {
          const [p, o] = await Promise.all([sellerApi.getProducts(), sellerApi.getOrders()]);
          setSellerProducts((p.data.data as Product[]) || []);
          setSellerOrders((o.data.data as SellerOrder[]) || []);
        } else {
          const r = await adminApi.getDashboard();
          setAdminStats((r.data.data as AdminDashboard) || null);
        }
      } catch { /* non-fatal */ }
      finally { setLoadingData(false); }
    };
    load();
  }, [role]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Photo ─────────────────────────────────────────────────
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error('Max file size is 10 MB'); return; }
    e.target.value = '';
    setCropSrc(URL.createObjectURL(file));
  };

  const handleCropDone = async (blob: Blob) => {
    setCropSrc(null);
    const localUrl = URL.createObjectURL(blob);
    setPhotoPreview(localUrl);
    setUploadingPhoto(true);
    try {
      const file = new File([blob], 'profile.jpg', { type: 'image/jpeg' });
      const res  = await authApi.uploadProfilePhoto(file);
      const path = res.data.data?.profile_photo;
      if (path) { updateUser({ profile_photo: path }); toast.success('Profile photo updated!'); }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Upload failed');
      setPhotoPreview(null);
    } finally { setUploadingPhoto(false); }
  };

  // ── Edit profile ──────────────────────────────────────────
  const openEdit = () => {
    setEditForm({ username: user?.username ?? '', phone: user?.phone ?? '' });
    setShowEdit(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await authApi.updateProfile({
        username: editForm.username.trim() || undefined,
        phone:    editForm.phone.trim()    || undefined,
      });
      if (res.data.data) { setUser(res.data.data); toast.success('Profile updated!'); setShowEdit(false); }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Update failed');
    } finally { setSaving(false); }
  };

  // ── Delete account ────────────────────────────────────────
  const handleDelete = async () => {
    setDeleting(true);
    try {
      await authApi.deleteAccount();
      clearUser();
      toast.success('Account deleted successfully.');
      navigate('/');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Failed to delete account');
    } finally { setDeleting(false); setShowDelete(false); }
  };

  if (!user) return <PageSpinner />;

  const COVER: Record<string, string> = {
    customer: 'from-gray-900 via-gray-800 to-gray-900',
    seller:   'from-blue-900 via-blue-800 to-indigo-900',
    admin:    'from-orange-700 via-orange-600 to-amber-600',
  };

  const displayPhoto = photoPreview ?? user.profile_photo;

  // ── Inline stats (inside profile card) ───────────────────
  const renderStats = () => {
    if (loadingData) return (
      <div className="grid grid-cols-3 gap-4 mt-5 pt-5 border-t border-gray-100 dark:border-slate-700">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-12 bg-gray-100 dark:bg-slate-700 rounded-xl animate-pulse" />
        ))}
      </div>
    );

    const divider = 'mt-5 pt-5 border-t border-gray-100 dark:border-slate-700';

    if (role === 'customer') {
      const spent = customerOrders.filter((o) => o.status !== 'cancelled').reduce((s, o) => s + o.amount, 0);
      return (
        <div className={cn('grid grid-cols-3 gap-4', divider)}>
          {[
            { label: 'Total Orders', value: customerOrders.length },
            { label: 'Total Spent',  value: formatPrice(spent) },
            { label: 'Delivered',    value: customerOrders.filter((o) => o.status === 'delivered').length },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-xl font-bold text-gray-900 dark:text-slate-100">{s.value}</p>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      );
    }

    if (role === 'seller') {
      const rev = sellerOrders.filter((o) => o.status !== 'cancelled').reduce((s, o) => s + o.seller_total, 0);
      return (
        <div className={cn('grid grid-cols-3 gap-4', divider)}>
          {[
            { label: 'Products', value: sellerProducts.length },
            { label: 'Orders',   value: sellerOrders.length },
            { label: 'Revenue',  value: formatPrice(rev) },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-xl font-bold text-gray-900 dark:text-slate-100">{s.value}</p>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      );
    }

    return (
      <div className={cn('grid grid-cols-2 sm:grid-cols-4 gap-4', divider)}>
        {[
          { label: 'Users',    value: adminStats?.total_users    ?? 0 },
          { label: 'Products', value: adminStats?.total_products ?? 0 },
          { label: 'Orders',   value: adminStats?.total_orders   ?? 0 },
          { label: 'Revenue',  value: formatPrice(adminStats?.total_revenue ?? 0) },
        ].map((s) => (
          <div key={s.label} className="text-center">
            <p className="text-xl font-bold text-gray-900 dark:text-slate-100">{s.value}</p>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>
    );
  };

  // ── Activity / stat cards below profile card ──────────────
  const renderActivity = () => {
    if (loadingData) return null;

    if (role === 'customer' && customerOrders.length > 0) {
      return (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 overflow-hidden shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-slate-700">
            <h2 className="font-bold text-gray-900 dark:text-slate-100">Recent Orders</h2>
            <button
              onClick={() => navigate('/user/orders')}
              className="text-xs text-orange-500 hover:text-orange-600 font-medium"
            >
              View all →
            </button>
          </div>
          <div className="divide-y divide-gray-50 dark:divide-slate-700/50">
            {customerOrders.slice(0, 5).map((o) => (
              <div
                key={o.uuid}
                className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
              >
                <div>
                  <p className="text-xs font-mono text-gray-500 dark:text-slate-400">
                    #{o.uuid.slice(0, 8).toUpperCase()}
                  </p>
                  <p className="font-semibold text-gray-900 dark:text-slate-100 mt-0.5">
                    {formatPrice(o.amount)}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-slate-500">{formatDate(o.date)}</p>
                </div>
                <Badge variant={orderStatusBadge(o.status)}>
                  {o.status.charAt(0).toUpperCase() + o.status.slice(1)}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (role === 'seller') {
      const rev = sellerOrders.filter((o) => o.status !== 'cancelled').reduce((s, o) => s + o.seller_total, 0);
      return (
        <div className="grid sm:grid-cols-2 gap-4">
          <StatCard label="Listed Products"     value={sellerProducts.length}  icon={<Package size={20} />}     {...STAT_CARDS.products} />
          <StatCard label="Total Orders"        value={sellerOrders.length}    icon={<ShoppingBag size={20} />} {...STAT_CARDS.orders} />
          <StatCard label="Revenue"             value={formatPrice(rev)}       icon={<TrendingUp size={20} />}  {...STAT_CARDS.revenue} />
          <StatCard label="Approved Categories" value={sellerOrders.length > 0 ? '✓ Active' : '—'} icon={<CheckCircle size={20} />} {...STAT_CARDS.categories} />
        </div>
      );
    }

    if (role === 'admin') {
      return (
        <div className="grid sm:grid-cols-2 gap-4">
          <StatCard label="Total Users"    value={adminStats?.total_users    ?? 0} icon={<Users size={20} />}       {...STAT_CARDS.users} />
          <StatCard label="Total Products" value={adminStats?.total_products ?? 0} icon={<Package size={20} />}     {...STAT_CARDS.products} />
          <StatCard label="Total Orders"   value={adminStats?.total_orders   ?? 0} icon={<ShoppingBag size={20} />} {...STAT_CARDS.orders} />
          <StatCard label="Revenue"        value={formatPrice(adminStats?.total_revenue ?? 0)} icon={<TrendingUp size={20} />} {...STAT_CARDS.revenue} />
        </div>
      );
    }

    return null;
  };

  return (
    <div className="space-y-6">

      {/* ── Profile card ── */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 overflow-hidden shadow-sm">
        {/* Cover gradient */}
        <div className={`h-28 bg-gradient-to-r ${COVER[role]}`} />

        <div className="px-6 pb-6">
          {/* Avatar row */}
          <div className="flex items-end justify-between -mt-12 mb-4">
            <div className="relative">
              <Avatar src={displayPhoto} name={user.username} />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploadingPhoto}
                className="absolute bottom-0 right-0 w-8 h-8 bg-orange-500 hover:bg-orange-600 active:scale-95 text-white rounded-full flex items-center justify-center shadow-lg transition-all disabled:opacity-60"
                title="Change photo"
              >
                {uploadingPhoto
                  ? <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <Camera size={14} />
                }
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            </div>
            <Button variant="outline" size="sm" onClick={openEdit}>
              <Pencil size={14} /> Edit Profile
            </Button>
          </div>

          {/* Name + meta */}
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">{user.username}</h1>
              <span className={cn(
                'text-xs px-2 py-0.5 rounded-full font-medium capitalize',
                role === 'admin'  ? 'bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400' :
                role === 'seller' ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400' :
                                    'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400'
              )}>
                {role}
              </span>
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-gray-500 dark:text-slate-400 mt-2">
              <span className="flex items-center gap-1.5">
                <Mail size={14} className="text-gray-400 dark:text-slate-500" /> {user.email}
              </span>
              {user.phone && (
                <span className="flex items-center gap-1.5">
                  <Phone size={14} className="text-gray-400 dark:text-slate-500" /> {user.phone}
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <Shield size={14} className="text-green-500" />
                <span className="text-green-600 dark:text-green-400 font-medium">Verified</span>
              </span>
            </div>
          </div>

          {renderStats()}
        </div>
      </div>

      {/* ── Activity / stat cards ── */}
      {renderActivity()}

      {/* ── Danger zone ── */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-red-100 dark:border-red-500/30 overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-red-100 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10">
          <h2 className="font-bold text-red-700 dark:text-red-400 flex items-center gap-2">
            <AlertTriangle size={16} /> Danger Zone
          </h2>
        </div>
        <div className="px-5 py-4 flex items-center justify-between gap-4">
          <div>
            <p className="font-medium text-gray-800 dark:text-slate-200">Delete Account</p>
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
              Permanently deactivate your account. This cannot be undone.
            </p>
          </div>
          <Button variant="danger" size="sm" onClick={() => setShowDelete(true)} className="shrink-0">
            <Trash2 size={14} /> Delete
          </Button>
        </div>
      </div>

      {/* ── Cropper Modal ── */}
      <Modal isOpen={!!cropSrc} onClose={() => setCropSrc(null)} title="Crop Profile Photo" size="md">
        {cropSrc && (
          <ImageCropper
            src={cropSrc}
            size={300}
            onCrop={handleCropDone}
            onCancel={() => setCropSrc(null)}
          />
        )}
      </Modal>

      {/* ── Edit Profile Modal ── */}
      <Modal isOpen={showEdit} onClose={() => setShowEdit(false)} title="Edit Profile" size="md">
        <form onSubmit={handleSave} className="space-y-4">
          <Input
            label="Username"
            value={editForm.username}
            onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
            icon={<User size={15} />}
            placeholder="Your display name"
          />
          <Input
            label="Phone Number"
            value={editForm.phone}
            onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
            icon={<Phone size={15} />}
            placeholder="+91 98765 43210"
            type="tel"
          />
          <div className="bg-gray-50 dark:bg-slate-700/50 rounded-xl p-3 text-xs text-gray-500 dark:text-slate-400 flex items-start gap-2">
            <Lock size={13} className="mt-0.5 shrink-0 text-gray-400 dark:text-slate-500" />
            Email cannot be changed. Contact support if needed.
          </div>
          <div className="flex gap-3 pt-1">
            <Button type="button" variant="ghost" onClick={() => setShowEdit(false)} className="flex-1">
              <X size={15} /> Cancel
            </Button>
            <Button type="submit" loading={saving} className="flex-1">
              <Save size={15} /> Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── Delete Account Confirmation Modal (replaces browser confirm()) ── */}
      <Modal isOpen={showDelete} onClose={() => setShowDelete(false)} title="Delete Account" size="sm">
        <div className="space-y-4">
          <div className="bg-red-50 dark:bg-red-500/10 rounded-xl p-4 text-sm text-red-700 dark:text-red-400 border border-red-100 dark:border-red-500/20">
            <p className="font-semibold mb-1 flex items-center gap-2">
              <AlertTriangle size={15} /> This cannot be undone
            </p>
            <p className="text-red-600 dark:text-red-400/80">
              Your account will be permanently deactivated. All your data will become inaccessible.
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => setShowDelete(false)} className="flex-1">
              Cancel
            </Button>
            <Button variant="danger" loading={deleting} onClick={handleDelete} className="flex-1">
              <Trash2 size={14} /> Yes, Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
