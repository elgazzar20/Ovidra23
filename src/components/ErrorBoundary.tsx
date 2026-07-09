import { Component, type ReactNode } from "react";

/**
 * Lightweight render safety net. If a page (e.g. a student/teacher profile)
 * throws during render — which on a static host would otherwise show a blank
 * white screen — this boundary surfaces a friendly, bilingual fallback with a
 * "retry" action instead of crashing the whole shell.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary] a page failed to render:", error);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex min-h-[55vh] flex-col items-center justify-center gap-3 p-8 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-100 text-2xl text-rose-600 dark:bg-rose-500/15 dark:text-rose-300">
          ⚠️
        </div>
        <h2 className="text-lg font-bold text-ink">حدث خطأ غير متوقع</h2>
        <p className="max-w-md text-sm text-muted">
          تعذّر عرض هذه الصفحة مؤقتًا. يمكنك العودة ثم المحاولة مرة أخرى.
        </p>
        {this.state.error.message && (
          <code className="max-w-lg truncate rounded-md bg-elevated px-2 py-1 text-[11px] text-faint">
            {this.state.error.message}
          </code>
        )}
        <button
          onClick={this.reset}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
        >
          إعادة المحاولة
        </button>
      </div>
    );
  }
}
