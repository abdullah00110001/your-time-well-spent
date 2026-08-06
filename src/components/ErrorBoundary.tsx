import { Component, ErrorInfo, ReactNode } from 'react';


interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
  }

  componentDidMount() {
    // Auto-recover from dynamic import errors by reloading once
    window.addEventListener('unhandledrejection', this.handlePromiseRejection);
  }

  componentWillUnmount() {
    window.removeEventListener('unhandledrejection', this.handlePromiseRejection);
  }

  private handlePromiseRejection = (event: PromiseRejectionEvent) => {
    const msg = String(event.reason?.message || event.reason || '');
    if (msg.includes('dynamically imported module') || msg.includes('Failed to fetch')) {
      event.preventDefault();
      // Reload once to recover from stale chunks
      const reloadKey = 'error_reload_attempted';
      if (!sessionStorage.getItem(reloadKey)) {
        sessionStorage.setItem(reloadKey, '1');
        window.location.reload();
      }
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      const errorMsg = this.state.error?.message || '';
      const isDynamicImportError = errorMsg.includes('dynamically imported module') || errorMsg.includes('Failed to fetch');

      // Auto-reload for chunk errors
      if (isDynamicImportError) {
        const reloadKey = 'error_reload_attempted';
        if (!sessionStorage.getItem(reloadKey)) {
          sessionStorage.setItem(reloadKey, '1');
          window.location.reload();
          return null;
        }
      }
      
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-6">
          <div className="text-center max-w-md">
            <div className="mb-4 text-4xl">⚠️</div>
            <h1 className="text-xl font-bold text-foreground mb-2">Something went wrong</h1>
            <p className="text-sm text-muted-foreground mb-4">
              {isDynamicImportError 
                ? 'The app needs to reload. Please tap the button below.'
                : (errorMsg || 'An unexpected error occurred.')}
            </p>
            <div className="flex flex-col gap-3 items-center">
              <button
                onClick={() => {
                  sessionStorage.removeItem('error_reload_attempted');
                  this.setState({ hasError: false, error: null });
                  window.location.href = '/dashboard';
                }}
                className="w-48 px-6 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium"
              >
                Go to Dashboard
              </button>
              <button
                onClick={() => {
                  sessionStorage.removeItem('error_reload_attempted');
                  this.setState({ hasError: false, error: null });
                  window.location.reload();
                }}
                className="w-48 px-6 py-2 border border-border text-foreground rounded-lg text-sm font-medium"
              >
                Reload App
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
