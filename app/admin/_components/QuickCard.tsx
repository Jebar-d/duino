import type { LucideIcon } from "lucide-react";

export function QuickCard({
  icon,
  title,
  description,
  onClick,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  onClick: () => void;
}) {
  const Icon = icon;
  return (
    <button className="adm-qc" onClick={onClick}>
      <div className="adm-qc-icon"><Icon aria-hidden="true" /></div>
      <h3>{title}</h3>
      <p>{description}</p>
      <div className="adm-qc-arr">Open →</div>
    </button>
  );
}
