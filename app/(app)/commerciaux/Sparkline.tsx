// Pure SVG sparkline — no client-side JS. Renders a 30-bucket area-fill
// line chart sized to fit a table cell. Width/height are fixed so the
// column layout stays predictable; the path scales to the values.

type Props = {
  values: number[];
  width?: number;
  height?: number;
  color: string;
};

export default function Sparkline({ values, width = 96, height = 28, color }: Props) {
  if (values.length === 0) {
    return <span style={{ color: "var(--text-muted)", fontSize: "var(--fs-xs)" }}>—</span>;
  }
  const max = Math.max(...values, 1); // avoid div-by-zero when all zeros
  const step = width / Math.max(values.length - 1, 1);
  const pts = values.map((v, i) => {
    const x = i * step;
    const y = height - (v / max) * height;
    return [x, y] as const;
  });

  // Build the line path + an area-fill path that closes back to the baseline.
  const linePath = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const areaPath =
    `M 0 ${height} ` +
    pts.map(([x, y]) => `L ${x.toFixed(1)} ${y.toFixed(1)}`).join(" ") +
    ` L ${width} ${height} Z`;

  // Highlight the last point so it reads as "today".
  const lastX = pts[pts.length - 1][0];
  const lastY = pts[pts.length - 1][1];
  const allZero = values.every((v) => v === 0);

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      {!allZero && (
        <>
          <path d={areaPath} fill={color} fillOpacity="0.14" />
          <path d={linePath} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
          <circle cx={lastX} cy={lastY} r="2" fill={color} />
        </>
      )}
      {allZero && (
        <line
          x1="0"
          y1={height - 0.5}
          x2={width}
          y2={height - 0.5}
          stroke="var(--border-subtle)"
          strokeWidth="1"
          strokeDasharray="2 2"
        />
      )}
    </svg>
  );
}
