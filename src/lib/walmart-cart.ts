/**
 * Build the VTEX `/checkout/cart/add` handoff URL. Walmart GT's storefront
 * accepts repeated `sku=&qty=&seller=` triples on this endpoint; the page
 * sets the orderForm cookie and redirects the user into the cart with all
 * items present. This is how we hand off our in-app cart to walmart.com.gt.
 *
 * Reference (verified live with browser DevTools):
 *   https://www.walmart.com.gt/checkout/cart/add?sku=100535&qty=2&seller=1
 */

const WALMART_BASE = "https://www.walmart.com.gt";
const DEFAULT_SELLER = "1";

export type CartHandoffItem = {
  sku: string;
  qty: number;
  seller?: string;
};

export function buildWalmartCartUrl(items: CartHandoffItem[]): string {
  if (items.length === 0) return `${WALMART_BASE}/checkout/`;
  const params = new URLSearchParams();
  for (const it of items) {
    if (!it.sku || it.qty <= 0) continue;
    params.append("sku", it.sku);
    params.append("qty", String(it.qty));
    params.append("seller", it.seller ?? DEFAULT_SELLER);
  }
  params.append("redirect", "true");
  return `${WALMART_BASE}/checkout/cart/add?${params.toString()}`;
}
