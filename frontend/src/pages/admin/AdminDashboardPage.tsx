import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, Package, ShoppingBag, TrendingUp, Plus,
  CheckCircle, Clock, Truck, XCircle, RefreshCw,
  ArrowRight, BarChart3, DollarSign, Activity,
  Star, AlertTriangle, Eye,
} from 'lucide-react';
import { adminApi } from '@/api/admin';
import { formatPrice, formatDate, getImageUrl } from '@/utils/image';
import { Badge, orderStatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { PageSpinner } from '@/components/ui/Spinner';
import { cn } from '@/utils/cn';
import toast from 'react-hot-toast';

// ── Types ─────────────────────────────────────────────────────
interface ItemPreview {
  product_uuid: string;
  product_name: string;
  quantity: number;
  image: string | null;
}

interface DashboardData {
  total_users: number;
  total_products: number;
  total_orders: number;
  total_revenue: number;
  order_status_breakdown: Record<string, number>;
  recent_orders: {
    uuid: string;
    amount: number;
    status: string;
    payment_method: string;
    date: string;
    items_preview: ItemPreview[];
  }[];
  top_products: {
    name: string;
    uuid: string;
    total_sold: number;
    total_revenue: number;
  }[];
}

// ── Stat card ─────────────────────────────────────────────────
function StatCard({
  title, value, icon, gradient, sub,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  gradient: string;
  sub?: string;
}) {
  return (
    <div className={cn(
      'rounded-2xl p-5 text-white relative overflow-hidden',
      gradient,
    )}>
      {/* Background decoration */}
      <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-white/10" />
      <div className="absolute -right-2 -bottom-6 w-16 h-16 rounded-full bg-white/10" />

      <div className="relative">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-white/80">{title}</p>
          <div className="p-2 bg-white/20 rounded-xl">{icon}</div>
        </div>
        <p className="text-3xl font-bold tracking-tight">{value}</p>
        {sub && <p className="text-xs text-white/70 mt-1">{sub}</p>}
      </div>
    </div>
  );
}

// ── Mini bar chart (pure CSS) ─────────────────────────────────
function MiniBarChart({ data }: { data: Record<string, number> }) {
  const entries = Object.entries(data);
  const max = Math.max(...entries.map(([, v]) => v), 1);

  const COLORS: Record<string, string> = {
    pending:    'bg-yellow-400',
    processing: 'bg-blue-400',
    shipped:    'bg-orange-400',
    delivered:  'bg-green-400',
    cancelled:  'bg-red-400',
  };

  return (
    <div className="flex items-end gap-2 h-20">
      {entries.map(([status, count]) => (
        <div key={status} className="flex-1 flex flex-col items-center gap-1">
          <span className="text-xs font-bold text-gray-700 dark:text-slate-300">{count}</span>
          <div
            className={cn('w-full rounded-t-md transition-all duration-500', COLORS[status] ?? 'bg-gray-400')}
            style={{ height: `${Math.max(4, (count / max) * 56)}px` }}
          />
          <span className="text-[10px] text-gray-400 dark:text-slate-500 capitalize truncate w-full text-center">
            {status.slice(0, 4)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Donut ring (SVG) ──────────────────────────────────────────
function DonutRing({ data }: { data: Record<string, number> }) {
  const total = Object.values(data).reduce((a, b) => a + b, 0) || 1;
  const COLORS: Record<string, string> = {
    delivered:  '#22c55e',
    shipped:    '#f97316',
    processing: '#3b82f6',
    pending:    '#eab308',
    cancelled:  '#ef4444',
  };

  const r = 40;
  const circ = 2 * Math.PI * r;
  let offset = 0;

  const slices = Object.entries(data).map(([status, count]) => {
    const pct   = count / total;
    const dash  = pct * circ;
    const slice = { status, count, pct, dash, offset };
    offset += dash;
    return slice;
  });

  return (
    <div className="flex items-center gap-4">
      <svg width="100" height="100" viewBox="0 0 100 100" className="shrink-0">
        <circle cx="50" cy="50" r={r} fill="none" stroke="#e5e7eb" strokeWidth="14" className="dark:stroke-slate-700" />
        {slices.map((s) => (
          <circle
            key={s.status}
            cx="50" cy="50" r={r}
            fill="none"
            stroke={COLORS[s.status] ?? '#94a3b8'}
            strokeWidth="14"
            strokeDasharray={`${s.dash} ${circ - s.dash}`}
            strokeDashoffset={-s.offset + circ / 4}
            strokeLinecap="butt"
          />
        ))}
        <text x="50" y="54" textAnchor="middle" className="fill-gray-800 dark:fill-slate-100" fontSize="14" fontWeight="bold">
          {total}
        </text>
      </svg>
      <div className="space-y-1.5 min-w-0">
        {slices.map((s) => (
          <div key={s.status} className="flex items-center gap-2 text-xs">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ background: COLORS[s.status] ?? '#94a3b8' }}
            />
            <span className="text-gray-600 dark:text-slate-400 capitalize">{s.status}</span>
            <span className="font-semibold text-gray-800 dark:text-slate-200 ml-auto">{s.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const STATUS_ICONS: Record<string, React.ReactNode> = {
  pending:    <Clock size={14} className="text-yellow-500" />,
  processing: <Package size={14} className="text-blue-500" />,
  shipped:    <Truck size={14} className="text-orange-500" />,
  delivered:  <CheckCircle size={14} className="text-green-500" />,
  cancelled:  <XCircle size={14} className="text-red-500" />,
};

// ── Main page ─────────────────────────────────────────────────
export function AdminDashboardPage() {
  const [data,    setData]    = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCatModal, setShowCatModal] = useState(false);
  const [catForm, setCatForm] = useState({ name: '', description: '', icon: '' });
  const [savingCat, setSavingCat] = useState(false);

  const fetchDashboard = () => {
    setLoading(true);
    adminApi.getDashboard()
      .then((r) => setData((r.data.data as DashboardData) || null))
      .catch(() => toast.error('Failed to load dashboard'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchDashboard(); }, []);

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catForm.name.trim()) { toast.error('Category name required'); return; }
    setSavingCat(true);
    try {
      await adminApi.createCategory(catForm);
      toast.success('Category created!');
      setShowCatModal(false);
      setCatForm({ name: '', description: '', icon: '' });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Failed to create category');
    } finally {
      setSavingCat(false);
    }
  };

  if (loading) return <PageSpinner />;

  const breakdown = data?.order_status_breakdown ?? {};
  const delivered = breakdown['delivered'] ?? 0;
  const total_orders = data?.total_orders ?? 0;
  const fulfillmentRate = total_orders > 0 ? Math.round((delivered / total_orders) * 100) : 0;

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Admin Dashboard</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
            Platform overview · {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchDashboard}>
            <RefreshCw size={14} /> Refresh
          </Button>
          <Button size="sm" onClick={() => setShowCatModal(true)}>
            <Plus size={14} /> New Category
          </Button>
        </div>
      </div>

      {/* ── KPI stat cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Users"
          value={data?.total_users ?? 0}
          icon={<Users size={18} />}
          gradient="bg-gradient-to-br from-blue-500 to-blue-700"
          sub="Active accounts"
        />
        <StatCard
          title="Total Products"
          value={data?.total_products ?? 0}
          icon={<Package size={18} />}
          gradient="bg-gradient-to-br from-violet-500 to-violet-700"
          sub="Live listings"
        />
        <StatCard
          title="Total Orders"
          value={data?.total_orders ?? 0}
          icon={<ShoppingBag size={18} />}
          gradient="bg-gradient-to-br from-orange-500 to-orange-600"
          sub={`${fulfillmentRate}% fulfilled`}
        />
        <StatCard
          title="Total Revenue"
          value={formatPrice(data?.total_revenue ?? 0)}
          icon={<DollarSign size={18} />}
          gradient="bg-gradient-to-br from-emerald-500 to-emerald-700"
          sub="Completed payments"
        />
      </div>

      {/* ── Analytics row ── */}
      <div className="grid lg:grid-cols-3 gap-4">

        {/* Order status donut */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-5">
          <h2 className="font-bold text-gray-900 dark:text-slate-100 mb-4 flex items-center gap-2 text-sm">
            <Activity size={16} className="text-orange-500" /> Order Status
          </h2>
          {Object.keys(breakdown).length > 0
            ? <DonutRing data={breakdown} />
            : <p className="text-sm text-gray-400 dark:text-slate-500 text-center py-6">No orders yet</p>
          }
        </div>

        {/* Bar chart */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-5">
          <h2 className="font-bold text-gray-900 dark:text-slate-100 mb-4 flex items-center gap-2 text-sm">
            <BarChart3 size={16} className="text-blue-500" /> Volume by Status
          </h2>
          {Object.keys(breakdown).length > 0
            ? <MiniBarChart data={breakdown} />
            : <p className="text-sm text-gray-400 dark:text-slate-500 text-center py-6">No data</p>
          }
        </div>

        {/* Fulfillment rate ring */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-5 flex flex-col items-center justify-center gap-3">
          <h2 className="font-bold text-gray-900 dark:text-slate-100 text-sm flex items-center gap-2 self-start">
            <TrendingUp size={16} className="text-green-500" /> Fulfillment Rate
          </h2>
          {/* SVG progress ring */}
          <svg width="110" height="110" viewBox="0 0 110 110">
            <circle cx="55" cy="55" r="46" fill="none" stroke="#e5e7eb" strokeWidth="10" className="dark:stroke-slate-700" />
            <circle
              cx="55" cy="55" r="46"
              fill="none"
              stroke={fulfillmentRate >= 70 ? '#22c55e' : fulfillmentRate >= 40 ? '#f97316' : '#ef4444'}
              strokeWidth="10"
              strokeDasharray={`${(fulfillmentRate / 100) * 289} 289`}
              strokeDashoffset="72"
              strokeLinecap="round"
              className="transition-all duration-700"
            />
            <text x="55" y="52" textAnchor="middle" fontSize="20" fontWeight="bold" className="fill-gray-800 dark:fill-slate-100">
              {fulfillmentRate}%
            </text>
            <text x="55" y="68" textAnchor="middle" fontSize="9" className="fill-gray-400 dark:fill-slate-500">
              delivered
            </text>
          </svg>
          <p className="text-xs text-gray-500 dark:text-slate-400 text-center">
            {delivered} of {total_orders} orders delivered
          </p>
        </div>
      </div>

      {/* ── Recent orders + Top products ── */}
      <div className="grid lg:grid-cols-2 gap-6">

        {/* Recent orders */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-slate-700">
            <h2 className="font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
              <ShoppingBag size={16} className="text-orange-500" /> Recent Orders
            </h2>
            <Link to="/admin/category-requests" className="text-xs text-orange-500 hover:text-orange-600 flex items-center gap-1">
              View all <ArrowRight size={12} />
            </Link>
          </div>
          {(data?.recent_orders ?? []).length === 0 ? (
            <div className="text-center py-10 text-gray-400 dark:text-slate-500">
              <ShoppingBag size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">No orders yet</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-slate-700/50">
              {(data?.recent_orders ?? []).map((order) => (
                <div key={order.uuid} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                  {(order.items_preview ?? []).length > 0 ? (
                    <div className="flex -space-x-2 shrink-0">
                      {(order.items_preview ?? []).slice(0, 3).map((item, idx) => (
                        <div
                          key={idx}
                          style={{ zIndex: 3 - idx }}
                          className="relative w-9 h-9 rounded-lg overflow-hidden border-2 border-white dark:border-slate-800 bg-gray-100 dark:bg-slate-700 shrink-0"
                        >
                          <img
                            src={getImageUrl(item.image)}
                            alt={item.product_name}
                            className="w-full h-full object-cover"
                            onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder-product.png'; }}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="w-9 h-9 rounded-lg bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center shrink-0">
                      {STATUS_ICONS[order.status] ?? <Package size={14} />}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    {(order.items_preview ?? []).length > 0 && (
                      <p className="text-xs text-gray-600 dark:text-slate-400 truncate mb-0.5">
                        {(order.items_preview ?? []).map((i) => i.product_name).join(', ')}
                      </p>
                    )}
                    <p className="text-xs font-mono text-gray-500 dark:text-slate-400">#{order.uuid.slice(0, 8).toUpperCase()}</p>
                    <p className="text-xs text-gray-400 dark:text-slate-500">{formatDate(order.date)}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <Badge variant={orderStatusBadge(order.status)}>
                      {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                    </Badge>
                    <p className="font-bold text-gray-900 dark:text-slate-100 text-sm">{formatPrice(order.amount)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top products */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-slate-700">
            <h2 className="font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
              <Star size={16} className="text-yellow-500" /> Top Selling Products
            </h2>
          </div>
          {(data?.top_products ?? []).length === 0 ? (
            <div className="text-center py-10 text-gray-400 dark:text-slate-500">
              <Package size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">No sales data yet</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-slate-700/50">
              {(data?.top_products ?? []).map((p, idx) => {
                const medals = ['🥇', '🥈', '🥉'];
                return (
                  <div key={p.uuid} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                    <span className="text-lg shrink-0 w-7 text-center">
                      {medals[idx] ?? (
                        <span className="w-6 h-6 rounded-full bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 text-xs font-bold flex items-center justify-center">
                          {idx + 1}
                        </span>
                      )}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 dark:text-slate-200 truncate">{p.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-gray-400 dark:text-slate-500">{p.total_sold} units</span>
                        <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-slate-600" />
                        <span className="text-xs text-green-600 dark:text-green-400 font-medium">{formatPrice(p.total_revenue)}</span>
                      </div>
                    </div>
                    {/* Mini progress bar */}
                    <div className="w-16 shrink-0">
                      <div className="h-1.5 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-orange-400 rounded-full"
                          style={{
                            width: `${Math.min(100, (p.total_sold / ((data?.top_products?.[0]?.total_sold ?? 1) || 1)) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Quick action cards ── */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            title: 'Category Requests',
            desc:  'Review seller category approvals',
            to:    '/admin/category-requests',
            icon:  <AlertTriangle size={20} />,
            from:  'from-orange-500', to_: 'to-orange-600',
          },
          {
            title: 'Seller Surveillance',
            desc:  'Monitor revenue and activity',
            to:    '/admin/sellers',
            icon:  <Eye size={20} />,
            from:  'from-blue-600', to_: 'to-blue-700',
          },
          {
            title: 'Product Directory',
            desc:  'Browse all platform products',
            to:    '/admin/products',
            icon:  <Package size={20} />,
            from:  'from-slate-700', to_: 'to-slate-800',
          },
          {
            title: 'Manage Categories',
            desc:  'Edit icons, names and status',
            to:    '/admin/categories',
            icon:  <BarChart3 size={20} />,
            from:  'from-violet-600', to_: 'to-violet-700',
          },
        ].map((card) => (
          <div
            key={card.title}
            className={cn('rounded-2xl p-5 text-white bg-gradient-to-br', card.from, card.to_)}
          >
            <div className="p-2 bg-white/20 rounded-xl w-fit mb-3">{card.icon}</div>
            <h3 className="font-bold text-base mb-1">{card.title}</h3>
            <p className="text-white/70 text-xs mb-4">{card.desc}</p>
            <Link
              to={card.to}
              className="inline-flex items-center gap-1.5 bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
            >
              Open <ArrowRight size={12} />
            </Link>
          </div>
        ))}
      </div>

      {/* ── Create Category Modal ── */}
      <Modal isOpen={showCatModal} onClose={() => setShowCatModal(false)} title="Create New Category">
        <form onSubmit={handleCreateCategory} className="space-y-4">
          <div className="flex gap-3">
            <div className="w-20 shrink-0">
              <label className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-1 block">Icon</label>
              <input
                type="text"
                maxLength={4}
                placeholder="📱"
                value={catForm.icon}
                onChange={(e) => setCatForm({ ...catForm, icon: e.target.value })}
                className="w-full border border-gray-300 dark:border-slate-600 rounded-xl px-3 py-2.5 text-2xl text-center bg-white dark:bg-slate-800 focus:outline-none focus:border-orange-500 dark:focus:border-orange-400 transition-colors"
              />
            </div>
            <div className="flex-1">
              <Input
                label="Category Name"
                placeholder="e.g. Electronics"
                value={catForm.name}
                onChange={(e) => setCatForm({ ...catForm, name: e.target.value })}
                required
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-1 block">Description (optional)</label>
            <textarea
              value={catForm.description}
              onChange={(e) => setCatForm({ ...catForm, description: e.target.value })}
              rows={3}
              placeholder="Brief description of this category..."
              className="w-full border border-gray-300 dark:border-slate-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:border-orange-500 dark:focus:border-orange-400 resize-none transition-colors"
            />
          </div>
          {/* Preview */}
          {(catForm.icon || catForm.name) && (
            <div className="flex items-center gap-2 px-3 py-2 bg-orange-50 dark:bg-orange-500/10 rounded-xl border border-orange-200 dark:border-orange-500/30">
              {catForm.icon && <span className="text-xl">{catForm.icon}</span>}
              <span className="text-sm font-medium text-orange-700 dark:text-orange-400">
                {catForm.name || 'Category name'}
              </span>
            </div>
          )}
          <div className="flex gap-3">
            <Button type="button" variant="ghost" onClick={() => setShowCatModal(false)} className="flex-1">Cancel</Button>
            <Button type="submit" loading={savingCat} className="flex-1">Create Category</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
