import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Product } from "./extract-products";

const STORAGE_KEY = "walmart-mcp:cart";
const MAX_LINE_QTY = 99;

export type CartItem = {
  productId: string;
  sku: string;          // SKU/itemId for /checkout/cart/add
  seller: string;       // VTEX seller id, default "1"
  name: string;
  brand: string;
  price: number;        // sellingPrice at time of add
  imageUrl: string;
  link: string;         // walmart.com.gt product page
  qty: number;
};

type CartContextValue = {
  items: CartItem[];
  count: number;        // sum of qty across lines
  total: number;        // sum of price × qty
  add: (p: Product, qty?: number) => void;
  /** Batch-add several products in one state update. Returns the count
   *  actually added (skips products without a SKU). */
  addMany: (entries: { product: Product; qty?: number }[]) => number;
  setQty: (productId: string, qty: number) => void;
  inc: (productId: string) => void;
  dec: (productId: string) => void;
  remove: (productId: string) => void;
  clear: () => void;
  has: (productId: string) => boolean;
  qtyOf: (productId: string) => number;
};

const CartContext = createContext<CartContextValue | null>(null);

function readStorage(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function productToItem(p: Product, qty: number): CartItem | null {
  const sku = p.skus[0]?.itemId;
  if (!sku) return null; // Can't add without a SKU
  return {
    productId: p.productId,
    sku,
    seller: "1",
    name: p.name,
    brand: p.brand,
    price: p.sellingPrice,
    imageUrl: p.images[0]?.imageUrl ?? "",
    link: p.link,
    qty: Math.max(1, Math.min(qty, MAX_LINE_QTY)),
  };
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => readStorage());

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // ignore quota / private mode
    }
  }, [items]);

  const add = useCallback((p: Product, qty: number = 1) => {
    setItems((prev) => {
      const existing = prev.find((it) => it.productId === p.productId);
      if (existing) {
        return prev.map((it) =>
          it.productId === p.productId
            ? { ...it, qty: Math.min(it.qty + qty, MAX_LINE_QTY) }
            : it,
        );
      }
      const fresh = productToItem(p, qty);
      if (!fresh) return prev;
      return [...prev, fresh];
    });
  }, []);

  const addMany = useCallback(
    (entries: { product: Product; qty?: number }[]) => {
      // Count addable entries upfront (those with a valid SKU). This is what
      // the caller surfaces in the success banner.
      const addable = entries.filter((e) => e.product.skus[0]?.itemId);
      setItems((prev) => {
        const next = [...prev];
        for (const { product, qty = 1 } of addable) {
          const idx = next.findIndex((it) => it.productId === product.productId);
          if (idx >= 0) {
            next[idx] = {
              ...next[idx],
              qty: Math.min(next[idx].qty + qty, MAX_LINE_QTY),
            };
            continue;
          }
          const fresh = productToItem(product, qty);
          if (!fresh) continue;
          next.push(fresh);
        }
        return next;
      });
      return addable.length;
    },
    [],
  );

  const setQty = useCallback((productId: string, qty: number) => {
    if (qty <= 0) {
      setItems((prev) => prev.filter((it) => it.productId !== productId));
      return;
    }
    setItems((prev) =>
      prev.map((it) =>
        it.productId === productId
          ? { ...it, qty: Math.min(qty, MAX_LINE_QTY) }
          : it,
      ),
    );
  }, []);

  const inc = useCallback((productId: string) => {
    setItems((prev) =>
      prev.map((it) =>
        it.productId === productId
          ? { ...it, qty: Math.min(it.qty + 1, MAX_LINE_QTY) }
          : it,
      ),
    );
  }, []);

  const dec = useCallback((productId: string) => {
    setItems((prev) => {
      const it = prev.find((x) => x.productId === productId);
      if (!it) return prev;
      if (it.qty <= 1) return prev.filter((x) => x.productId !== productId);
      return prev.map((x) =>
        x.productId === productId ? { ...x, qty: x.qty - 1 } : x,
      );
    });
  }, []);

  const remove = useCallback((productId: string) => {
    setItems((prev) => prev.filter((it) => it.productId !== productId));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const has = useCallback(
    (productId: string) => items.some((it) => it.productId === productId),
    [items],
  );

  const qtyOf = useCallback(
    (productId: string) => items.find((it) => it.productId === productId)?.qty ?? 0,
    [items],
  );

  const count = useMemo(
    () => items.reduce((s, it) => s + it.qty, 0),
    [items],
  );
  const total = useMemo(
    () => items.reduce((s, it) => s + it.price * it.qty, 0),
    [items],
  );

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      count,
      total,
      add,
      addMany,
      setQty,
      inc,
      dec,
      remove,
      clear,
      has,
      qtyOf,
    }),
    [items, count, total, add, addMany, setQty, inc, dec, remove, clear, has, qtyOf],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
