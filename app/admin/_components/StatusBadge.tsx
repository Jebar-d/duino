import { statusClass } from "./utils";

export function StatusBadge({ status }: { status: string }) {
  return <span className={statusClass(status)}>{status}</span>;
}
