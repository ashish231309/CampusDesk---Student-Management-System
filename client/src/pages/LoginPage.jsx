import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { CircleAlert, Eye, EyeOff, LogIn, UserPlus } from 'lucide-react';

import { Button } from '../components/ui/Button.jsx';
import { Field, TextInput } from '../components/ui/Field.jsx';
import { useAuth } from '../context/authContext.js';
import { useToast } from '../context/toastContext.js';
import { useForm } from '../hooks/useForm.js';
import { paths } from '../routes/paths.js';
import { email as emailRule, required } from '../utils/validation.js';

/**
 * Only presence is checked here. The API decides whether the credentials are
 * valid, and it deliberately does not tell the client which password rules an
 * account was created under.
 */
const schema = {
  email: [required('Enter your email address.'), emailRule()],
  password: [required('Enter your password.')],
};

export default function LoginPage() {
  const { login, isAuthenticated } = useAuth();
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
        // `useForm` also merges any field-level `details` the API sent back, so
        // a validation failure lands on the input and a rejected sign-in is
        // explained in one sentence.
        toast.error(error.message, 'Sign in failed');
      }
    },
  });

  return (
    <>
      <h1 className="mt-6 text-[26px] leading-tight font-semibold tracking-tight text-ink">
        Sign in to CampusDesk
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Sign in with the campus account you registered on this desk.
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

      <p className="mt-6 text-center text-[13px] text-muted">
        New to CampusDesk?{' '}
        <Link
          to={paths.register}
          className="focus-ring inline-flex items-center gap-1 rounded font-semibold text-ink underline decoration-line underline-offset-4 transition-colors hover:decoration-charcoal"
        >
          <UserPlus className="size-3.5" aria-hidden="true" />
          Create an account
        </Link>
      </p>

    </>
  );
}
