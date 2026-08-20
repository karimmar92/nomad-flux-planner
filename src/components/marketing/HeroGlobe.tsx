/**
 * The hero's decorative globe.
 *
 * A dotted wireframe sphere in SVG, drawn from two loops of ellipses rather
 * than a traced path: no asset to download, no image to keep in sync with the
 * palette, and it inherits currentColor so it re-tints with the theme. Purely
 * ornamental, so it is aria-hidden and never carries information.
 */
export function HeroGlobe({ className }: { className?: string }) {
  const meridians = [8, 26, 44, 62, 80]; // rx values, in viewBox units
  const parallels = [
    { cy: 100, rx: 88, ry: 88 },
    { cy: 62, rx: 78, ry: 26 },
    { cy: 100, rx: 88, ry: 30 },
    { cy: 138, rx: 78, ry: 26 },
  ];
  return (
    <svg
      viewBox="0 0 200 200"
      className={className}
      fill="none"
      aria-hidden
      focusable="false"
    >
      <defs>
        <radialGradient id="rm-globe-core" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.18" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="100" cy="100" r="88" fill="url(#rm-globe-core)" />
      <g stroke="currentColor" strokeOpacity="0.35" strokeWidth="0.8">
        {parallels.map((p) => (
          <ellipse key={`p${p.cy}-${p.ry}`} cx="100" cy={p.cy} rx={p.rx} ry={p.ry} />
        ))}
        {meridians.map((rx) => (
          <ellipse key={`m${rx}`} cx="100" cy="100" rx={rx} ry="88" />
        ))}
      </g>
      <g fill="currentColor">
        {[
          [62, 58],
          [141, 78],
          [88, 148],
          [154, 128],
          [46, 118],
        ].map(([cx, cy]) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="3" fillOpacity="0.85" />
        ))}
      </g>
    </svg>
  );
}
