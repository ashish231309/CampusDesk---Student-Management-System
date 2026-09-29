import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, ShieldCheck, UserPlus } from 'lucide-react';

import { Button } from '../components/ui/Button.jsx';
import { FormAlert } from '../components/ui/States.jsx';
import { Field, TextInput } from '../components/ui/Field.jsx';
import { useAuth } from '../context/authContext.js';
import { useToast } from '../context/toastContext.js';
import { useForm } from '../hooks/useForm.js';
import { paths } from '../routes/paths.js';
import { errorMessage } from '../utils/apiErrors.js';
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

export default function RegisterPage() {
  const { register, isAuthenticated } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [showPassword, setShowPassword] = useState(false);

  /**
   * Where the visitor was heading, query string included, so creating an account
   * from a shared link continues to the screen that link described.
   */
  const from = location.state?.from;
  const redirectTo = from ? `${from.pathname}${from.search ?? ''}` : paths.dashboard;

  // The session change below is the only thing that navigates; the submit
  // handler does not also redirect, so a new account is followed exactly once.
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
      } catch (error) {
        toast.error(errorMessage(error), 'Could not create your account');
      }
    },
  });

  return (
    <>
      <h1 className="text-title font-semibold text-ink">Create your CampusDesk account</h1>
      <p className="mt-2.5 text-label leading-relaxed text-muted">
        New accounts start with staff access to the student register.
      </p>

      {form.submitError ? <FormAlert className="mt-6">{form.submitError}</FormAlert> : null}

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

      <p className="mt-5 flex items-start gap-2 rounded-card border border-line bg-surface-muted px-4 py-3 text-meta leading-relaxed text-muted">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
        Roles are assigned by CampusDesk, never by the sign-up form. An administrator can raise
        an account's access later.
      </p>

      <p className="mt-6 border-t border-line/60 pt-5 text-center text-label text-muted">
        Already have an account?{' '}
        <Link
          to={paths.login}
          className="focus-ring rounded font-semibold text-ink underline decoration-line underline-offset-4 transition-colors hover:decoration-charcoal"
        >
          Sign in
        </Link>
      </p>
    </>
  );
}
