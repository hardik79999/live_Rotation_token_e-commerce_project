import { Link, useNavigate } from 'react-router-dom';
import {
  ShoppingCart, Heart, User, Search, Menu, X,
  Package, LayoutDashboard, LogOut, Tag, Wallet,
} from 'lucide-react';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useCartStore } from '@/store/cartStore';
import { authApi } from '@/api/auth';
import { browseApi } from '@/api/user';
import toast from 'react-hot-toast';
import { cn } from '@/utils/cn';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { formatPrice } from '@/utils/image';
import type { Product } from '@/types';

// ── Debounce hook ─────────────────────────────────────────────
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export function Navbar() {
  const { user, isAuthenticated, clearUser } = useAuthStore();
  const { itemCount } = useCartStore();
  const navigate = useNavigate();

  const [search,       setSearch]       = useState('');
  const [suggestions,  setSuggestions]  = useState<Product[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loadingSugg,  setLoadingSugg]  = useState(false);
  const [menuOpen,     setMenuOpen]     = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const dropdownRef  = useRef<HTMLDivElement>(null);
  const searchRef    = useRef<HTMLDivElement>(null);
  const debouncedQ   = useDebounce(search.trim(), 250);

  // ── Close user dropdown on outside click ─────────────────
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Live search suggestions ───────────────────────────────
  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.length === 0) { setSuggestions([]); setShowDropdown(false); return; }
    setLoadingSugg(true);
    try {
      const res = await browseApi.getProducts({ search: q, limit: 6 });
      const items = res.data.data || [];
      setSuggestions(items);
      setShowDropdown(items.length > 0);
    } catch {
      setSuggestions([]);
      setShowDropdown(false);
    } finally {
      setLoadingSugg(false);
    }
  }, []);

  useEffect(() => {
    fetchSuggestions(debouncedQ);
  }, [debouncedQ, fetchSuggestions]);

  // ── Submit full search ────────────────────────────────────
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (search.trim()) {
      navigate(`/products?search=${encodeURIComponent(search.trim())}`);
      setSearch('');
      setShowDropdown(false);
    }
  };

  const handleSuggestionClick = (product: Product) => {
    setSearch('');
    setShowDropdown(false);
    navigate(`/product/${product.uuid}`);
  };

  const handleLogout = async () => {
    try { await authApi.logout(); } catch { /* ignore */ }
    clearUser();
    toast.success('Logged out successfully');
    navigate('/');
  };

  const dashboardLink =
    user?.role === 'admin'   ? '/admin/dashboard' :
    user?.role === 'seller'  ? '/seller/products' :
                               '/user/dashboard';

  const profileLink =
    user?.role === 'admin'   ? '/admin/profile' :
    user?.role === 'seller'  ? '/seller/profile' :
                               '/user/profile';

  const avatarLetter = user?.username?.[0]?.toUpperCase() ?? '?';

  // ── Search box (shared between desktop + mobile) ──────────
  function SearchBox({ className }: { className?: string }) {
    return (
      <div ref={searchRef} className={cn('relative', className)}>
        <form onSubmit={handleSearch}>
          <div className="flex w-full rounded-lg overflow-hidden border border-gray-600 focus-within:border-orange-400 transition-colors">
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); }}
              onFocus={() => { if (suggestions.length > 0) setShowDropdown(true); }}
              placeholder="Search products..."
              className="flex-1 bg-white text-gray-900 px-4 py-2 text-sm outline-none"
              autoComplete="off"
            />
            <button type="submit" className="bg-orange-500 hover:bg-orange-600 px-4 transition-colors shrink-0">
              {loadingSugg
                ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
                : <Search size={18} />
              }
            </button>
          </div>
        </form>

        {/* Suggestions dropdown */}
        {showDropdown && suggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden z-50">
            {suggestions.map((p) => (
              <button
                key={p.uuid}
                type="button"
                onClick={() => handleSuggestionClick(p)}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-orange-50 transition-colors text-left"
              >
                {/* Thumbnail */}
                <div className="w-9 h-9 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                  <img
                    src={getImageUrl(p.primary_image)}
                    alt={p.name}
                    className="w-full h-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder-product.png'; }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  {/* Highlight matching chars */}
                  <p className="text-sm font-medium text-gray-800 truncate">
                    {highlightMatch(p.name, search)}
                  </p>
                  <p className="text-xs text-orange-500">{p.category}</p>
                </div>
                <p className="text-sm font-bold text-gray-900 shrink-0">
                  ₹{p.price.toLocaleString('en-IN')}
                </p>
              </button>
            ))}
            {/* View all results */}
            <button
              type="button"
              onClick={handleSearch as unknown as React.MouseEventHandler}
              className="w-full px-4 py-2.5 text-sm text-orange-500 hover:bg-orange-50 font-medium border-t border-gray-100 flex items-center gap-2 transition-colors"
            >
              <Search size={14} />
              See all results for "<span className="font-semibold">{search}</span>"
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <header className="sticky top-0 z-40 bg-gray-900/95 backdrop-blur-md text-white shadow-lg border-b border-gray-800/50">
      {/* Top bar */}
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 shrink-0">
          <img
            src="/logo.png"
            alt="ShopHub"
            className="h-12 w-auto object-contain"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
          <span className="text-xl font-bold tracking-tight">
            Shop<span className="text-orange-400">Hub</span>
          </span>
        </Link>

        {/* Desktop search */}
        <SearchBox className="flex-1 max-w-2xl hidden sm:block" />

        {/* Right actions */}
        <div className="flex items-center gap-2 ml-auto sm:ml-0">
          {/* Cart */}
          <Link to="/cart" className="relative p-2 rounded-lg hover:bg-gray-700 transition-colors" aria-label="Cart">
            <ShoppingCart size={22} />
            {itemCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                {itemCount > 99 ? '99+' : itemCount}
              </span>
            )}
          </Link>

          {/* Wishlist */}
          {isAuthenticated && user?.role === 'customer' && (
            <Link to="/user/wishlist" className="p-2 rounded-lg hover:bg-gray-700 transition-colors" aria-label="Wishlist">
              <Heart size={22} />
            </Link>
          )}

          {/* Theme toggle */}
          <ThemeToggle />

          {/* Auth */}
          {isAuthenticated ? (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen((v) => !v)}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-700 transition-colors text-sm"
              >
                <UserAvatar
                  src={user?.profile_photo}
                  name={user?.username ?? '?'}
                  size="xs"
                  className="ring-2 ring-orange-400"
                />
                <span className="hidden md:block max-w-[100px] truncate">{user?.username}</span>
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-52 bg-white text-gray-800 rounded-xl shadow-xl border border-gray-100 py-1 z-50">
                  <div className="px-4 py-2 border-b border-gray-100">
                    <p className="font-semibold text-sm truncate">{user?.username}</p>
                    <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                    <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full capitalize mt-1 inline-block">
                      {user?.role}
                    </span>
                    {user?.role === 'customer' && (
                      <div className="flex items-center gap-1.5 mt-2 bg-orange-50 rounded-lg px-2 py-1.5">
                        <Wallet size={13} className="text-orange-500 shrink-0" />
                        <span className="text-xs font-semibold text-orange-700">
                          {formatPrice(user.wallet_balance ?? 0)}
                        </span>
                        <span className="text-xs text-orange-500">wallet</span>
                      </div>
                    )}
                  </div>
                  <Link to={dashboardLink} onClick={() => setDropdownOpen(false)} className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-gray-50 transition-colors">
                    <LayoutDashboard size={15} /> Dashboard
                  </Link>
                  <Link to={profileLink} onClick={() => setDropdownOpen(false)} className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-gray-50 transition-colors">
                    <User size={15} /> My Profile
                  </Link>
                  {user?.role === 'customer' && (
                    <Link to="/user/orders" onClick={() => setDropdownOpen(false)} className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-gray-50 transition-colors">
                      <Package size={15} /> My Orders
                    </Link>
                  )}
                  {user?.role === 'customer' && (
                    <Link to="/user/wallet" onClick={() => setDropdownOpen(false)} className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-gray-50 transition-colors">
                      <Wallet size={15} /> Wallet & Rewards
                    </Link>
                  )}
                  <button onClick={handleLogout} className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors">
                    <LogOut size={15} /> Logout
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link to="/login" className="px-3 py-1.5 text-sm rounded-lg hover:bg-gray-700 transition-colors">Login</Link>
              <Link to="/signup" className="px-3 py-1.5 text-sm bg-orange-500 hover:bg-orange-600 rounded-lg transition-colors font-medium">Sign Up</Link>
            </div>
          )}

          {/* Mobile menu toggle */}
          <button className="sm:hidden p-2 rounded-lg hover:bg-gray-700 transition-colors" onClick={() => setMenuOpen((v) => !v)}>
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Mobile search */}
      <div className={cn('sm:hidden px-4 pb-3', !menuOpen && 'hidden')}>
        <SearchBox />
      </div>

      {/* Category nav */}
      <nav className="bg-gray-800 border-t border-gray-700">
        <div className="max-w-7xl mx-auto px-4 flex items-center gap-6 overflow-x-auto py-2 text-sm scrollbar-hide">
          <Link to="/products" className="whitespace-nowrap hover:text-orange-400 transition-colors">All Products</Link>
          <Link to="/products?category=" className="whitespace-nowrap hover:text-orange-400 transition-colors flex items-center gap-1">
            <Tag size={13} /> Categories
          </Link>
          {!isAuthenticated && (
            <Link to="/signup?role=seller" className="whitespace-nowrap hover:text-orange-400 transition-colors">Sell on ShopHub</Link>
          )}
        </div>
      </nav>
    </header>
  );
}

// ── Highlight matching substring ──────────────────────────────
function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-orange-100 text-orange-700 rounded px-0.5 not-italic font-semibold">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}
