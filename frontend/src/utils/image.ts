// In production (.env.production), VITE_API_BASE_URL is '' (empty string).
// ?? falls back only on null/undefined — NOT on empty string.
// This means production uses relative paths, dev uses http://localhost:7899.
const BASE = import.meta.env.VITE_API_BASE_URL ?? '';

/**
 * Convert a relative image path from the backend (/static/uploads/...)
 * into a full URL pointing at the Flask server.
 */
export function getImageUrl(path: string | null | undefined): string {
  if (!path) return '/placeholder-product.png';
  if (path.startsWith('http')) return path;
  return `${BASE}${path}`;
}

export function formatPrice(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
