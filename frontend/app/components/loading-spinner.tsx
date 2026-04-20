type LoadingSpinnerProps = {
  label?: string;
  fullPage?: boolean;
  compact?: boolean;
  className?: string;
};

export default function LoadingSpinner({
  label = "Carregando",
  fullPage = false,
  compact = false,
  className,
}: LoadingSpinnerProps) {
  const wrapperClassName = ["loading-state", fullPage ? "is-page" : "", compact ? "is-compact" : "", className ?? ""]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={wrapperClassName} role="status" aria-live="polite" aria-label={label}>
      <span className={`loading-spinner${compact ? " is-small" : ""}`} aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </div>
  );
}
