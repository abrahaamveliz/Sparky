import { useEffect, useRef, type ReactNode } from "react";

/**
 * Horizontally-scrolling row of product cards. Sets data attributes on the
 * wrapper so the CSS edge-fades light up only when overflow is present
 * (`data-overflow-l` / `data-overflow-r`).
 */
export function HScrollGrid({ children }: { children: ReactNode }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const grid = gridRef.current;
    const wrap = wrapRef.current;
    if (!grid || !wrap) return;
    const update = () => {
      const left = grid.scrollLeft > 4;
      const right = grid.scrollLeft + grid.clientWidth < grid.scrollWidth - 4;
      wrap.dataset.overflowL = String(left);
      wrap.dataset.overflowR = String(right);
    };
    update();
    grid.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(grid);
    return () => {
      grid.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, []);

  return (
    <div ref={wrapRef} className="pgrid-wrap">
      <div ref={gridRef} className="pgrid">
        {children}
      </div>
    </div>
  );
}
