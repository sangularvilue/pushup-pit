export default function BrandMark({ size = 30 }: { size?: number }) {
  return (
    <svg
      className="brand-mark"
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden="true"
    >
      <rect width="64" height="64" rx="12" fill="#16352a" stroke="rgba(243,234,215,0.25)" />
      <polyline
        points="8,44 34,44 54,18"
        fill="none"
        stroke="#e3b04e"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="34" cy="36" r="4.5" fill="#f3ead7" />
      <line x1="8" y1="52" x2="56" y2="52" stroke="#3ecf81" strokeWidth="3" strokeLinecap="round" opacity="0.8" />
    </svg>
  );
}
