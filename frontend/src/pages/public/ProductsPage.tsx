import { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SlidersHorizontal, ChevronLeft, ChevronRight, X, Package } from 'lucide-react';
import { browseApi } from '@/api/user';
import type { Product, Category } from '@/types';
import { ProductCard } from '@/components/product/ProductCard';
import { ProductGridSkeleton } from '@/components/ui/Skeleton';
import { Button } from '@/components/ui/Button';

const SORT_OPTIONS = [
  { value: 'newest',            label: 'Newest First' },
  { value: 'price_low_to_high', label: 'Price: Low → High' },
  { value: 'price_high_to_low', label: 'Price: High → Low' },
];

// ── Debounce hook ─────────────────────────────────────────────
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// ── Price range slider ────────────────────────────────────────
function PriceRangeFilter({
  min, max, onChange,
}: {
  min: string; max: string;
  onChange: (min: string, max: string) => void;
}) {
  const [localMin, setLocalMin] = useState(min);
  const [localMax, setLocalMax] = useState(max);

  // Sync when URL params change externally
  useEffect(() => { setLocalMin(min); }, [min]);
  useEffect(() => { setLocalMax(max); }, [max]);

  const commit = () => onChange(localMin, localMax);

  return (
    <div className="mt-5">
      <h3 className="font-semibold text-gray-800 dark:text-slate-200 mb-3 text-sm">Price Range</h3>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={0}
          placeholder="Min"
          value={localMin}
          onChange={(e) => setLocalMin(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && commit()}
          className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-2 py-1.5 text-xs bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 focus:outline-none focus:border-orange-500 dark:focus:border-orange-400 transition-colors"
        />
        <span className="text-gray-400 dark:text-slate-500 text-xs shrink-0">–</span>
        <input
          type="number"
          min={0}
          placeholder="Max"
          value={localMax}
          onChange={(e) => setLocalMax(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && commit()}
          className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-2 py-1.5 text-xs bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 focus:outline-none focus:border-orange-500 dark:focus:border-orange-400 transition-colors"
        />
      </div>
      {(localMin || localMax) && (
        <button
          onClick={() => { setLocalMin(''); setLocalMax(''); onChange('', ''); }}
          className="mt-1.5 text-xs text-orange-500 hover:text-orange-600 transition-colors"
        >
          Clear price filter
        </button>
      )}
    </div>
  );
}

export function ProductsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products,     setProducts]     = useState<Product[]>([]);
  const [categories,   setCategories]   = useState<Category[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [totalPages,   setTotalPages]   = useState(1);
  const [totalResults, setTotalResults] = useState(0);

  // ── Read URL params ───────────────────────────────────────
  const page     = parseInt(searchParams.get('page')      || '1');
  const search   = searchParams.get('search')   || '';
  const category = searchParams.get('category') || '';
  const sortBy   = searchParams.get('sort_by')  || 'newest';
  const minPrice = searchParams.get('min_price') || '';
  const maxPrice = searchParams.get('max_price') || '';
  const inStock  = searchParams.get('in_stock')  || '';

  // ── Local search input (debounced before hitting URL) ─────
  const [searchInput, setSearchInput] = useState(search);
  const debouncedSearch = useDebounce(searchInput, 500);
  const isFirstRender = useRef(true);

  // Sync debounced search → URL (skip on first render to avoid double fetch)
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    const next = new URLSearchParams(searchParams);
    if (debouncedSearch) next.set('search', debouncedSearch);
    else next.delete('search');
    next.set('page', '1');
    setSearchParams(next, { replace: true });
  }, [debouncedSearch]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep local input in sync when URL changes externally (e.g. browser back)
  useEffect(() => { setSearchInput(search); }, [search]);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = {
        page, limit: 12, sort_by: sortBy,
      };
      if (search)   params.search   = search;
      if (category) params.category = category;
      if (minPrice) params.min_price = minPrice;
      if (maxPrice) params.max_price = maxPrice;
      if (inStock)  params.in_stock  = inStock;

      const res = await browseApi.getProducts(params);
      setProducts(res.data.data || []);
      setTotalPages(res.data.total_pages || 1);
      setTotalResults(res.data.total_results || 0);
    } finally {
      setLoading(false);
    }
  }, [page, search, category, sortBy, minPrice, maxPrice, inStock]);

  useEffect(() => {
    browseApi.getCategories().then((r) => setCategories(r.data.data || []));
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    next.set('page', '1');
    setSearchParams(next);
  };

  const updatePriceRange = (min: string, max: string) => {
    const next = new URLSearchParams(searchParams);
    if (min) next.set('min_price', min); else next.delete('min_price');
    if (max) next.set('max_price', max); else next.delete('max_price');
    next.set('page', '1');
    setSearchParams(next);
  };

  const setPage = (p: number) => {
    const next = new URLSearchParams(searchParams);
    next.set('page', String(p));
    setSearchParams(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Active filter count for mobile badge
  const activeFilters = [category, minPrice, maxPrice, inStock].filter(Boolean).length;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 sm:py-8 overflow-x-hidden">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-slate-100">
            {search ? `Results for "${search}"` : 'All Products'}
          </h1>
          {!loading && (
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
              {totalResults} product{totalResults !== 1 ? 's' : ''} found
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Debounced search bar */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search products…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="border border-gray-300 dark:border-slate-600 rounded-lg pl-3 pr-8 py-2 text-sm focus:outline-none focus:border-orange-500 dark:focus:border-orange-400 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 w-44 sm:w-56 transition-colors"
            />
            {searchInput && (
              <button
                onClick={() => { setSearchInput(''); updateParam('search', ''); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Sort */}
          <SlidersHorizontal size={16} className="text-gray-500 dark:text-slate-400 shrink-0" />
          <select
            value={sortBy}
            onChange={(e) => updateParam('sort_by', e.target.value)}
            className="border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 transition-colors"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex gap-6">
        {/* ── Sidebar (desktop) ── */}
        <aside className="hidden lg:block w-52 shrink-0">
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-4 sticky top-24">
            <h3 className="font-semibold text-gray-800 dark:text-slate-200 mb-3 text-sm">Categories</h3>
            <ul className="space-y-0.5">
              <li>
                <button
                  onClick={() => updateParam('category', '')}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                    !category
                      ? 'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 font-medium'
                      : 'text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700'
                  }`}
                >
                  All Categories
                </button>
              </li>
              {categories.map((cat) => (
                <li key={cat.uuid}>
                  <button
                    onClick={() => updateParam('category', cat.uuid)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                      category === cat.uuid
                        ? 'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 font-medium'
                        : 'text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700'
                    }`}
                  >
                    {cat.name}
                  </button>
                </li>
              ))}
            </ul>

            {/* Price range */}
            <PriceRangeFilter
              min={minPrice}
              max={maxPrice}
              onChange={updatePriceRange}
            />

            {/* In-stock toggle */}
            <div className="mt-5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={inStock === '1'}
                  onChange={(e) => updateParam('in_stock', e.target.checked ? '1' : '')}
                  className="accent-orange-500 w-4 h-4"
                />
                <span className="text-sm text-gray-700 dark:text-slate-300">In Stock Only</span>
              </label>
            </div>

            {/* Clear all filters */}
            {activeFilters > 0 && (
              <button
                onClick={() => {
                  const next = new URLSearchParams();
                  if (search) next.set('search', search);
                  next.set('sort_by', sortBy);
                  setSearchParams(next);
                }}
                className="mt-4 w-full text-xs text-red-500 hover:text-red-600 border border-red-200 dark:border-red-500/30 rounded-lg py-1.5 transition-colors"
              >
                Clear {activeFilters} filter{activeFilters > 1 ? 's' : ''}
              </button>
            )}
          </div>
        </aside>

        {/* ── Main content ── */}
        <div className="flex-1 min-w-0">
          {/* Mobile category pills */}
          <div className="lg:hidden flex gap-2 overflow-x-auto pb-3 mb-4 scrollbar-hide">
            <button
              onClick={() => updateParam('category', '')}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-all active:scale-95 ${
                !category
                  ? 'bg-orange-500 text-white border-orange-500'
                  : 'border-gray-300 dark:border-slate-600 text-gray-600 dark:text-slate-400 bg-white dark:bg-slate-800 hover:border-orange-300'
              }`}
            >
              All
            </button>
            {categories.map((cat) => (
              <button
                key={cat.uuid}
                onClick={() => updateParam('category', cat.uuid)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-all active:scale-95 whitespace-nowrap ${
                  category === cat.uuid
                    ? 'bg-orange-500 text-white border-orange-500'
                    : 'border-gray-300 dark:border-slate-600 text-gray-600 dark:text-slate-400 bg-white dark:bg-slate-800 hover:border-orange-300'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {/* Active filter chips */}
          {(minPrice || maxPrice || inStock) && (
            <div className="flex flex-wrap gap-2 mb-4">
              {(minPrice || maxPrice) && (
                <span className="inline-flex items-center gap-1 bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-500/30 text-xs font-medium px-2.5 py-1 rounded-full">
                  ₹{minPrice || '0'} – ₹{maxPrice || '∞'}
                  <button onClick={() => updatePriceRange('', '')} className="hover:text-orange-800 ml-0.5">
                    <X size={11} />
                  </button>
                </span>
              )}
              {inStock && (
                <span className="inline-flex items-center gap-1 bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-500/30 text-xs font-medium px-2.5 py-1 rounded-full">
                  In Stock
                  <button onClick={() => updateParam('in_stock', '')} className="hover:text-green-800 ml-0.5">
                    <X size={11} />
                  </button>
                </span>
              )}
            </div>
          )}

          {/* Products grid */}
          {loading ? (
            <ProductGridSkeleton count={12} />
          ) : products.length === 0 ? (
            <div className="text-center py-20 bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700">
              <Package size={48} className="text-gray-300 dark:text-slate-600 mx-auto mb-4" />
              <p className="text-lg font-medium text-gray-600 dark:text-slate-400">No products found</p>
              <p className="text-sm text-gray-400 dark:text-slate-500 mt-1">
                Try adjusting your search or filters
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                {products.map((p) => (
                  <ProductCard key={p.uuid} product={p} onCartUpdate={() => {}} />
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-10 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage(page - 1)}
                  >
                    <ChevronLeft size={16} />
                  </Button>

                  {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                    const p = i + 1;
                    return (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        className={`w-9 h-9 rounded-lg text-sm font-medium transition-all active:scale-95 ${
                          p === page
                            ? 'bg-orange-500 text-white shadow-md shadow-orange-200 dark:shadow-orange-900/50'
                            : 'bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 hover:border-orange-400 hover:text-orange-500'
                        }`}
                      >
                        {p}
                      </button>
                    );
                  })}

                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage(page + 1)}
                  >
                    <ChevronRight size={16} />
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
