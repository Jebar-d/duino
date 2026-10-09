import type { LucideIcon } from "lucide-react";

export function StatCard({
  icon,
  iconClass,
  value,
  label,
}: {
  icon: LucideIcon;
  iconClass: string;
  value: string | number;
  label: string;
}) {
  const Icon = icon;
  return (
    <div className="adm-stat">
      <div className={`adm-stat-icon ${iconClass}`}><Icon aria-hidden="true" /></div>

      <div>
        <div className="adm-stat-val">{value}</div>
        <div className="adm-stat-lbl">{label}</div>
      </div>
    </div>
  );
}
