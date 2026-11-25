import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export default class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  declare props: Readonly<ErrorBoundaryProps>;
  state: ErrorBoundaryState = { hasError: false };

  constructor(props: ErrorBoundaryProps) {
    super(props);
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error('Application render error:', error.message);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0A0A0A] text-white flex items-center justify-center p-6 font-sans">
          <div className="max-w-md w-full rounded-2xl border border-white/10 bg-white/[0.03] p-8 space-y-4 text-center">
            <p className="text-xs font-medium text-[#D4AF37] tracking-wide uppercase">
              Moonshine Capital
            </p>
            <h1 className="text-2xl font-display font-light text-white">
              Unable to load view
            </h1>
            <p className="text-sm text-white/60 leading-relaxed">
              An unexpected client error interrupted rendering. Reload the page to return to the overview.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-6 py-2.5 rounded-full gold-gradient text-[#0A0A0A] text-xs font-semibold tracking-wide"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
