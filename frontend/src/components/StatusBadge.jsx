import { STATUS } from "@/lib/api";

export function StatusBadge({ status, testId }) {
  const s = STATUS[status] || { label: status, tone: "bg-stone-100 text-stone-700" };
  return (
    <span data-testid={testId} className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${s.tone}`}>
      {s.label}
    </span>
  );
}

export function Pill({ children, className = "" }) {
  return <span className={`inline-flex items-center rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold ${className}`}>{children}</span>;
}
