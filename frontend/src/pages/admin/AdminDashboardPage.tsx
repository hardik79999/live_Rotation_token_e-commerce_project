import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, Package, ShoppingBag, TrendingUp, Plus,
  CheckCircle, Clock, Truck, XCircle, RefreshCw,
  ArrowRight, BarChart3,
} from 'lucide-react';
import { adminApi } from '@/api/admin';
import { formatPrice, formatDate, getImageUrl } from '@/utils/image';
import { Badge, orderStatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { PageSpinner } from '@/components/ui/Spinner';
import toast from 'react-hot-toast';

// ── Extended dashboard type (matches new backend response) ───────────────
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

function StatCard({
  title, value, icon, color, bg, trend,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  bg: string;
  trend?: string;
}) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-5 flex items-center gap-4 hover:shadow-md transition-shadow">
      <div className={`p-3 rounded-xl ${bg} shrink-0`}>
        <div className={color}>{icon}</div>
      </div>
      <div className="min-w-0">
        <p className="text-sm text-gray-500 dark:text-slate-400 truncate">{title}</p>
        <p className="text-2xl font-bold text-gray-900 dark:text-slate-100 mt-0.5 truncate">{value}</p>
        {trend && <p className="text-xs text-green-600 mt-0.5">{trend}</p>}
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

export function AdminDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCatModal, setShowCatModal] = useState(false);
  const [catForm, setCatForm] = useState({ name: '', description: '' });
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
      setCatForm({ name: '', description: '' });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Failed to create category');
    } finally {
      setSavingCat(false);
    }
  };

  if (loading) return <PageSpinner />;

  const breakdown = data?.order_status_breakdown ?? {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Admin Dashboard</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">Platform overview and analytics</p>
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

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Users"
          value={data?.total_users ?? 0}
          icon={<Users size={22} />}
          color="text-blue-600"
          bg="bg-blue-50"
        />
        <StatCard
          title="Total Products"
          value={data?.total_products ?? 0}
          icon={<Package size={22} />}
          color="text-purple-600"
          bg="bg-purple-50"
        />
        <StatCard
          title="Total Orders"
          value={data?.total_orders ?? 0}
          icon={<ShoppingBag size={22} />}
          color="text-orange-600"
          bg="bg-orange-50"
        />
        <StatCard
          title="Total Revenue"
          value={formatPrice(data?.total_revenue ?? 0)}
          icon={<TrendingUp size={22} />}
          color="text-green-600"
          bg="bg-green-50"
        />
      </div>

      {/* Order status breakdown */}
      {Object.keys(breakdown).length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-5">
          <h2 className="font-bold text-gray-900 dark:text-slate-100 mb-4 flex items-center gap-2">
            <BarChart3 size={18} className="text-orange-500" /> Order Status Breakdown
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {Object.entries(breakdown).map(([status, count]) => (
              <div key={status} className="text-center bg-gray-50 dark:bg-slate-700/50 rounded-xl p-3">
                <div className="flex justify-center mb-1">
                  {STATUS_ICONS[status] ?? <Package size={14} />}
                </div>
                <p className="text-xl font-bold text-gray-900 dark:text-slate-100">{count}</p>
                <p className="text-xs text-gray-500 dark:text-slate-400 capitalize mt-0.5">{status}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent orders */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-slate-700">
            <h2 className="font-bold text-gray-900 dark:text-slate-100">Recent Orders</h2>
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
                  {/* Product thumbnails */}
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
                    {/* Product names */}
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
            <h2 className="font-bold text-gray-900 dark:text-slate-100">Top Selling Products</h2>
          </div>
          {(data?.top_products ?? []).length === 0 ? (
            <div className="text-center py-10 text-gray-400 dark:text-slate-500">
              <Package size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">No sales data yet</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-slate-700/50">
              {(data?.top_products ?? []).map((p, idx) => (
                <div key={p.uuid} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                  <span className="w-6 h-6 rounded-full bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 text-xs font-bold flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-slate-200 truncate">{p.name}</p>
                    <p className="text-xs text-gray-400 dark:text-slate-500">{p.total_sold} units sold</p>
                  </div>
                  <p className="font-bold text-gray-900 dark:text-slate-100 text-sm shrink-0">{formatPrice(p.total_revenue)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick action cards */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl p-5 text-white">
          <h3 className="font-bold text-lg mb-1">Category Requests</h3>
          <p className="text-orange-100 text-sm mb-4">Review and approve seller category requests</p>
          <Link
            to="/admin/category-requests"
            className="inline-flex items-center gap-2 bg-white text-orange-600 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-orange-50 transition-colors"
          >
            View Requests <ArrowRight size={14} />
          </Link>
        </div>
        <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-5 text-white">
          <h3 className="font-bold text-lg mb-1">Seller Surveillance</h3>
          <p className="text-blue-100 text-sm mb-4">Monitor every seller's revenue and activity</p>
          <Link
            to="/admin/sellers"
            className="inline-flex items-center gap-2 bg-white text-blue-700 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-50 transition-colors"
          >
            View Sellers <ArrowRight size={14} />
          </Link>
        </div>
        <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-5 text-white">
          <h3 className="font-bold text-lg mb-1">Product Directory</h3>
          <p className="text-gray-300 text-sm mb-4">Read-only view of all platform products</p>
          <Link
            to="/admin/products"
            className="inline-flex items-center gap-2 bg-white text-gray-800 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-100 transition-colors"
          >
            Browse Products <ArrowRight size={14} />
          </Link>
        </div>
      </div>

      {/* Create Category Modal */}
      <Modal isOpen={showCatModal} onClose={() => setShowCatModal(false)} title="Create New Category">
        <form onSubmit={handleCreateCategory} className="space-y-4">
          <Input
            label="Category Name"
            placeholder="e.g. Electronics"
            value={catForm.name}
            onChange={(e) => setCatForm({ ...catForm, name: e.target.value })}
            required
          />
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-1 block">Description (optional)</label>
            <textarea
              value={catForm.description}
              onChange={(e) => setCatForm({ ...catForm, description: e.target.value })}
              rows={3}
              placeholder="Brief description of this category..."
              className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:border-orange-500 dark:focus:border-orange-400 resize-none transition-colors"
            />
          </div>
          <div className="flex gap-3">
            <Button type="button" variant="ghost" onClick={() => setShowCatModal(false)} className="flex-1">Cancel</Button>
            <Button type="submit" loading={savingCat} className="flex-1">Create Category</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
