export function Spark({
  size = 20,
  color = "var(--accent)",
}: {
  size?: number;
  color?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M12 2 L13.6 9 L20.5 8 L15 12 L20.5 16 L13.6 15 L12 22 L10.4 15 L3.5 16 L9 12 L3.5 8 L10.4 9 Z"
        fill={color}
      />
    </svg>
  );
}
