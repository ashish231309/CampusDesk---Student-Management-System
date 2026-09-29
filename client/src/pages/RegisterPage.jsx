import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowLeft, CircleAlert, Eye, EyeOff, ShieldCheck, UserPlus } from 'lucide-react';

import { Logo } from '../components/branding/Logo.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Field, TextInput } from '../components/ui/Field.jsx';
import { useAuth } from '../context/authContext.js';
import { useToast } from '../context/toastContext.js';
import { useForm } from '../hooks/useForm.js';
import { appConfig } from '../config/app.js';
import { paths } from '../routes/paths.js';
import { email as emailRule, maxLength, minLength, required } from '../utils/validation.js';

/** Mirrors the API's password policy so the user is told before the round trip. */
const hasLetterAndNumber = (value) => {
  const text = String(value ?? '');
  if (!text) return undefined;
  if (!/[A-Za-z]/.test(text)) return 'Include at least one letter.';
  if (!/\d/.test(text)) return 'Include at least one number.';
  return undefined;
};

const matchesPassword = (value, values) =>
  value === values.password ? undefined : 'The two passwords do not match.';

const schema = {
  name: [
    required('Enter your full name.'),
    minLength(2, 'Name must be at least 2 characters.'),
    maxLength(80, 'Name cannot exceed 80 characters.'),
  ],
  email: [required('Enter your email address.'), emailRule()],
  password: [
    required('Choose a password.'),
    minLength(8, 'Passwords are at least 8 characters.'),
    maxLength(72, 'Passwords cannot exceed 72 characters.'),
    hasLetterAndNumber,
  ],
  confirmPassword: [required('Repeat your password.'), matchesPassword],
};

const HIGHLIGHTS = [
  'Create your own account in a minute — no provisioning ticket needed.',
  'Staff accounts manage the student register; administrators can do more.',
  'Your session stays signed in across refreshes until you sign out.',
];

export default function RegisterPage() {
  const { register, isAuthenticated } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [showPassword, setShowPassword] = useState(false);

  const redirectTo = location.state?.from?.pathname ?? paths.dashboard;

  useEffect(() => {
    if (isAuthenticated) navigate(redirectTo, { replace: true });
  }, [isAuthenticated, navigate, redirectTo]);

  const form = useForm({
    initialValues: { name: '', email: '', password: '', confirmPassword: '' },
    schema,
    onSubmit: async (values) => {
      try {
        // Only the API's own fields are sent — never `confirmPassword`, and
        // never a role: the server decides what a new account may do.
        await register({
          name: values.name,
          email: values.email,
          password: values.password,
        });
        toast.success('Your account is ready. Welcome to CampusDesk.', 'Account created');
        navigate(redirectTo, { replace: true });
      } catch (error) {
        toast.error(error.message, 'Could not create your account');
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
            Two minutes now, a tidy register later.
          </h2>

          <ul className="mt-6 space-y-3">
            {HIGHLIGHTS.map((highlight) => (
              <li
                key={highlight}
                className="flex items-start gap-3 text-sm leading-relaxed text-canvas/75"
              >
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
            to={paths.login}
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted transition-colors hover:text-ink"
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            Back to sign in
          </Link>

          <div className="mt-6 lg:hidden">
            <Logo tagline />
          </div>

          <h1 className="mt-6 text-[26px] leading-tight font-semibold tracking-tight text-ink">
            Create your CampusDesk account
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            New accounts start with staff access to the student register.
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
            <Field label="Full name" required error={form.errorFor('name')}>
              <TextInput
                type="text"
                name="name"
                autoComplete="name"
                placeholder="Ananya Sharma"
                value={form.values.name}
                onChange={form.handleChange('name')}
                onBlur={form.handleBlur('name')}
                hasError={Boolean(form.errorFor('name'))}
              />
            </Field>

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

            <Field
              label="Password"
              required
              error={form.errorFor('password')}
              hint="At least 8 characters, including a letter and a number."
            >
              <TextInput
                type={showPassword ? 'text' : 'password'}
                name="password"
                autoComplete="new-password"
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

            <Field label="Confirm password" required error={form.errorFor('confirmPassword')}>
              <TextInput
                type={showPassword ? 'text' : 'password'}
                name="confirmPassword"
                autoComplete="new-password"
                placeholder="••••••••"
                value={form.values.confirmPassword}
                onChange={form.handleChange('confirmPassword')}
                onBlur={form.handleBlur('confirmPassword')}
                hasError={Boolean(form.errorFor('confirmPassword'))}
              />
            </Field>

            <Button
              type="submit"
              size="lg"
              icon={UserPlus}
              isLoading={form.isSubmitting}
              className="w-full"
            >
              Create account
            </Button>
          </form>

          <p className="mt-5 flex items-start gap-2 rounded-card border border-line bg-surface px-4 py-3 text-[12px] leading-relaxed text-muted">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
            Roles are assigned by CampusDesk, never by the sign-up form. An administrator can raise
            an account's access later.
          </p>

          <p className="mt-6 text-center text-[13px] text-muted">
            Already have an account?{' '}
            <Link
              to={paths.login}
              className="focus-ring rounded font-semibold text-ink underline decoration-line underline-offset-4 transition-colors hover:decoration-charcoal"
            >
              Sign in
            </Link>
          </p>
        </motion.div>
      </main>
    </div>
  );
}
