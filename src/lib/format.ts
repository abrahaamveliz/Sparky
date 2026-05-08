export function formatGTQ(n: number | null | undefined): string {
  if (typeof n !== "number" || !Number.isFinite(n)) return "—";
  return `Q${n.toFixed(2)}`;
}
