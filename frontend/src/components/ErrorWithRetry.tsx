/** Error display with a retry button for failed requests. */

interface ErrorWithRetryProps {
  message: string;
  onRetry: () => void;
}

export function ErrorWithRetry({
  message,
  onRetry,
}: ErrorWithRetryProps): React.ReactElement {
  return (
    <div className="rd-error" role="alert">
      <p>{message}</p>
      <button type="button" className="outline" onClick={onRetry}>
        Retry
      </button>
    </div>
  );
}
