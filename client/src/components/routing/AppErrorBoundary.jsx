import { Component } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { CircleAlert, RotateCcw } from 'lucide-react';

import { Logo } from '../branding/Logo.jsx';
import { buttonClasses } from '../ui/buttonStyles.js';
import { paths } from '../../routes/paths.js';

/**
 * The last line of defence: a render-time crash anywhere below shows a calm
 * explanation instead of a blank page.
 *
 * It is deliberately separate from the API error handling. A request that fails
 * is a normal outcome and is explained beside the thing that failed
 * (`utils/apiErrors.js`); this catches the unexpected — a bug in a component —
 * and offers a reload. Nothing about the error itself is rendered, so a stack
 * trace or an internal message can never reach the screen.
 */
export class AppErrorBoundary extends Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error) {
    // Developer breadcrumb only. `import.meta.env.DEV` is replaced at build
    // time, so this disappears from a production bundle.
    if (import.meta.env.DEV) console.error('CampusDesk render error:', error);
  }

  componentDidUpdate(previous) {
    // Navigating away is a reset: the boundary must not keep showing the
    // fallback over a page the user has just asked for.
    if (this.state.hasError && previous.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, error: null });
    }
  }

  handleReload = () => window.location.reload();

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="grid min-h-dvh place-items-center bg-canvas px-4">
        <div className="w-full max-w-md rounded-card border border-line/70 bg-surface p-8 text-center shadow-card">
          <div className="flex justify-center">
            <Logo withWordmark={false} size="lg" />
          </div>

          <span className="mt-6 grid size-12 place-items-center rounded-2xl bg-danger/10 text-danger mx-auto">
            <CircleAlert className="size-5" aria-hidden="true" />
          </span>

          <h1 className="mt-4 text-title font-semibold text-ink">
            Something went wrong on this screen
          </h1>
          <p className="mt-2.5 text-sm leading-relaxed text-muted">
            CampusDesk hit an unexpected problem while drawing this page. Nothing was saved from
            this screen, and the records on the server are untouched.
          </p>

          <div className="mt-7 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <button type="button" onClick={this.handleReload} className={buttonClasses({})}>
              <RotateCcw className="size-4" aria-hidden="true" />
              Reload CampusDesk
            </button>
            <Link to={paths.dashboard} className={buttonClasses({ variant: 'secondary' })}>
              Back to dashboard
            </Link>
          </div>

          <p className="mt-6 text-meta text-muted">
            If this keeps happening, tell CampusDesk support what you were doing when it stopped.
          </p>
        </div>
      </div>
    );
  }
}

/**
 * Feeds the boundary the current location so a crash is cleared by navigating.
 * Kept here, rather than in the application root, so the root stays a plain
 * list of providers.
 */
export const RouteErrorBoundary = ({ children }) => {
  const { pathname } = useLocation();

  return (
    <AppErrorBoundary resetKey={pathname}>
      {children}
    </AppErrorBoundary>
  );
};
