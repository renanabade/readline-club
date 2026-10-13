// The club mark: a bookmark ribbon beside a lowercase "r". It takes the
// theme's ink for the tile and the page color for the drawing, so it flips
// between the light and dark themes.
export function BrandMark({ size = 36 }: { size?: number }) {
  return (
    <svg
      className="brand-mark"
      viewBox="0 0 512 512"
      width={size}
      height={size}
      aria-hidden="true"
    >
      <rect className="brand-mark-tile" width="512" height="512" rx="112" />
      <path
        className="brand-mark-ribbon"
        d="M288 135h75v240l-37.5-30-37.5 30Z"
      />
      <path
        className="brand-mark-letter"
        d="M170 367V260c0-40 30-46 76-46"
        strokeWidth="42"
        strokeLinecap="round"
      />
    </svg>
  );
}
