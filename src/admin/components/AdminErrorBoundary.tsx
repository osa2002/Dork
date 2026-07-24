/**
 * Enterprise Platform Administration - Error Boundary
 * Domain: Platform Administration (Isolated from Shop Dashboard)
 */

import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertOctagon, RotateCcw } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class AdminErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[AdminErrorBoundary] Uncaught React Error:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 text-center font-sans">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mb-6">
            <AlertOctagon className="w-8 h-8 text-rose-400" />
          </div>
          <h2 className="text-xl font-bold text-slate-100 mb-2">Admin Component Runtime Exception</h2>
          <p className="text-sm text-slate-400 max-w-md mb-6 leading-relaxed">
            An unhandled runtime error occurred within the Admin Portal interface. The system error has been captured for audit review.
          </p>
          {this.state.error && (
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-left font-mono text-xs text-rose-300 max-w-xl w-full mb-6 overflow-x-auto">
              {this.state.error.toString()}
            </div>
          )}
          <button
            onClick={this.handleReset}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition-all shadow-lg shadow-indigo-600/20 flex items-center gap-2 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            Reload Admin Console
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
