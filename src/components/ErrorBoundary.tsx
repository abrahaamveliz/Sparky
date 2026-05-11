import { Component, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  /** Optional inline-style fallback for child-level boundaries (e.g. one
   *  message turn). When omitted the full-screen fallback renders. */
  fallback?: ReactNode;
  /** Stable label used when reporting to telemetry / dev console. */
  label?: string;
};

type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    if (import.meta.env.DEV) {
      console.error(
        `[boundary:${this.props.label ?? "app"}]`,
        error,
        info.componentStack,
      );
    }
  }

  reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;
    if (this.props.fallback !== undefined) return this.props.fallback;

    return (
      <div className="boundary-fallback" role="alert">
        <div className="boundary-fallback-card">
          <div className="boundary-fallback-icon" aria-hidden="true">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4" />
              <path d="M12 16h.01" />
            </svg>
          </div>
          <h2>Something went wrong</h2>
          <p>
            The interface ran into an unexpected error. Reloading the page
            usually fixes it.
          </p>
          <div className="boundary-fallback-actions">
            <button
              type="button"
              className="confirm-ok confirm-ok--default"
              onClick={() => window.location.reload()}
            >
              Reload page
            </button>
            <button
              type="button"
              className="confirm-cancel"
              onClick={this.reset}
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }
}
