import { useEffect, useState } from 'react';
import { Heart } from 'lucide-react';
import { wishlistApi } from '@/api/user';
import type { Product } from '@/types';
import { ProductCard } from '@/components/product/ProductCard';
import { PageSpinner } from '@/components/ui/Spinner';
import toast from 'react-hot-toast';

export function WishlistPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchWishlist = () => {
    wishlistApi.getWishlist()
      .then((r) => setProducts((r.data.data as Product[]) || []))
      .catch(() => toast.error('Failed to load wishlist'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchWishlist(); }, []);

  if (loading) return <PageSpinner />;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-6">My Wishlist</h1>

      {products.length === 0 ? (
        <div className="text-center py-20">
          <Heart size={64} className="text-gray-300 dark:text-slate-600 mx-auto mb-4" />
          <p className="text-xl font-semibold text-gray-700 dark:text-slate-300 mb-2">Your wishlist is empty</p>
          <p className="text-gray-500 dark:text-slate-400">Save products you love to buy them later</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {products.map((p) => (
            <ProductCard
              key={p.uuid}
              product={p}
              initialWishlisted={true}
              onCartUpdate={fetchWishlist}
            />
          ))}
        </div>
      )}
    </div>
  );
}
