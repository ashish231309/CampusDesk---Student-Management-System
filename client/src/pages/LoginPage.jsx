import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowLeft, CircleAlert, Eye, EyeOff, LogIn, ShieldCheck } from 'lucide-react';

import { Logo } from '../components/branding/Logo.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Field, TextInput } from '../components/ui/Field.jsx';
import { useAuth } from '../context/authContext.js';
import { useToast } from '../context/toastContext.js';
import { useForm } from '../hooks/useForm.js';
import { appConfig } from '../config/app.js';
import { paths } from '../routes/paths.js';
import { email as emailRule, minLength, required } from '../utils/validation.js';

const schema = {
  email: [required('Enter your email address.'), emailRule()],
  password: [required('Enter your password.'), minLength(6, 'Passwords are at least 6 characters.')],
};

const HIGHLIGHTS = [
  'One record per student, from registration to graduation.',
  'Search, filter and review the whole register in seconds.',
  'Enrolment numbers that reconcile without a spreadsheet.',
];

export default function LoginPage() {
  const { login, isAuthenticated, isPreviewAvailable, enterPreview } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [showPassword, setShowPassword] = useState(false);

  const redirectTo = location.state?.from?.pathname ?? paths.dashboard;

  useEffect(() => {
    if (isAuthenticated) navigate(redirectTo, { replace: true });
  }, [isAuthenticated, navigate, redirectTo]);

  const form = useForm({
    initialValues: { email: '', password: '' },
    schema,
    onSubmit: async (values) => {
      try {
        await login(values);
        toast.success('Welcome back to CampusDesk.', 'Signed in');
        navigate(redirectTo, { replace: true });
      } catch (error) {
        // Surfaces the API's own message, so an unfinished endpoint or a wrong
        // password both tell the user exactly what happened.
        toast.error(error.message, 'Sign in failed');
      }
    },
  });

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_1.05fr]">
      {/* Brand panel — hidden on small screens where the form is the whole point. */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-charcoal px-10 py-12 lg:flex">
        <div
          className="absolute -top-24 -right-24 size-[420px] rounded-full bg-beige/15 blur-2xl"
          aria-hidden="true"
        />

        <Link to={paths.home} className="relative inline-flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-beige">
            <svg viewBox="0 0 40 40" className="size-6" role="img" aria-label="CampusDesk">
              <path
                d="M27.5 14.5a9 9 0 1 0 0 11"
                fill="none"
                stroke="#323232"
                strokeWidth="3.4"
                strokeLinecap="round"
              />
              <path d="M13.5 30.5h17" stroke="#323232" strokeWidth="3.4" strokeLinecap="round" />
            </svg>
          </span>
          <span className="text-[17px] font-extrabold tracking-tight text-canvas">
            Campus<span className="text-beige">Desk</span>
          </span>
        </Link>

        <div className="relative max-w-md">
          <h2 className="text-[30px] leading-tight font-semibold text-canvas">
            The register your campus actually keeps up with.
          </h2>

          <ul className="mt-6 space-y-3">
            {HIGHLIGHTS.map((highlight) => (
              <li key={highlight} className="flex items-start gap-3 text-sm leading-relaxed text-canvas/75">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-beige" aria-hidden="true" />
                {highlight}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-[12px] text-canvas/50">
          {appConfig.name} · {appConfig.tagline}
        </p>
      </aside>

      <main className="flex flex-col justify-center bg-canvas px-4 py-10 sm:px-8 lg:px-14">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto w-full max-w-[420px]"
        >
          <Link
            to={paths.home}
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted transition-colors hover:text-ink"
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            Back to home
          </Link>

          <div className="mt-6 lg:hidden">
            <Logo tagline />
          </div>

          <h1 className="mt-6 text-[26px] leading-tight font-semibold tracking-tight text-ink">
            Sign in to CampusDesk
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Use your campus account. Accounts are provisioned by campus IT.
          </p>

          {form.submitError ? (
            <div
              role="alert"
              className="mt-6 flex items-start gap-3 rounded-card border border-danger/25 bg-danger/[0.06] px-4 py-3"
            >
              <CircleAlert className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
              <p className="text-[13px] leading-relaxed text-ink">{form.submitError}</p>
            </div>
          ) : null}

          <form className="mt-6 space-y-4" onSubmit={form.handleSubmit} noValidate>
            <Field label="Email address" required error={form.errorFor('email')}>
              <TextInput
                type="email"
                name="email"
                autoComplete="email"
                placeholder="you@campusdesk.edu"
                value={form.values.email}
                onChange={form.handleChange('email')}
                onBlur={form.handleBlur('email')}
                hasError={Boolean(form.errorFor('email'))}
              />
            </Field>

            <Field label="Password" required error={form.errorFor('password')}>
              <TextInput
                type={showPassword ? 'text' : 'password'}
                name="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={form.values.password}
                onChange={form.handleChange('password')}
                onBlur={form.handleBlur('password')}
                hasError={Boolean(form.errorFor('password'))}
                className="pr-11"
              />

              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="focus-ring absolute top-1/2 right-2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-muted transition-colors hover:bg-beige/50 hover:text-ink"
              >
                {showPassword ? (
                  <EyeOff className="size-4" aria-hidden="true" />
                ) : (
                  <Eye className="size-4" aria-hidden="true" />
                )}
              </button>
            </Field>

            <Button
              type="submit"
              size="lg"
              icon={LogIn}
              isLoading={form.isSubmitting}
              className="w-full"
            >
              Sign in
            </Button>
          </form>

          {isPreviewAvailable ? (
            <div className="mt-6 rounded-card border border-line bg-surface p-4">
              <p className="flex items-center gap-2 text-[13px] font-semibold text-ink">
                <ShieldCheck className="size-4 text-muted" aria-hidden="true" />
                Development preview
              </p>
              <p className="mt-1.5 text-[12px] leading-relaxed text-muted">
                Authentication endpoints are still being built. You can browse the application shell
                with sample records instead.
              </p>
              <Button
                variant="secondary"
                size="sm"
                className="mt-3 w-full"
                onClick={() => {
                  enterPreview();
                  navigate(paths.dashboard, { replace: true });
                }}
              >
                Continue in preview mode
              </Button>
            </div>
          ) : null}
        </motion.div>
      </main>
    </div>
  );
}
