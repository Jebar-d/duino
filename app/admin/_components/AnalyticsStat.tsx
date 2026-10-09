export function AnalyticsStat({
  value,
  label,
  sub,
}: {
  value: string | number;
  label: string;
  sub: string;
}) {
  return (
    <div className="an-stat">
      <div className="an-stat-val">{value}</div>
      <div className="an-stat-lbl">{label}</div>
      <div className="an-stat-sub">{sub}</div>
    </div>
  );
}
