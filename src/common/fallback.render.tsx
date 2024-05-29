import { ErrorBoundary } from "react-error-boundary";

export function CommonErrorFallback({ error, resetErrorBoundary }) {
  return (
    <div>
      common error fallback
    </div>
  );
}