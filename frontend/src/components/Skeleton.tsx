/** Skeleton loading placeholder with pulsing bars. */

interface SkeletonProps {
  lines?: number;
  showHeader?: boolean;
}

export function Skeleton({
  lines = 3,
  showHeader = true,
}: SkeletonProps): React.ReactElement {
  return (
    <div className="rd-skeleton" aria-busy="true" aria-label="Loading content">
      {showHeader && <div className="rd-skeleton__header" />}
      {Array.from({ length: lines }, (_, i) => (
        <div
          key={i}
          className="rd-skeleton__line"
          style={{ width: `${85 - i * 10}%` }}
        />
      ))}
    </div>
  );
}
