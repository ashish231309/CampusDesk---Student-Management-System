import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import { motion, useReducedMotion } from 'motion/react';
import {
  ArrowRight,
  BadgeCheck,
  CalendarClock,
  IdCard,
  LayoutDashboard,
  Search,
  ShieldCheck,
} from 'lucide-react';

import { Logo } from '../components/branding/Logo.jsx';
import { Avatar } from '../components/ui/Avatar.jsx';
import { StatusPill } from '../components/ui/Badge.jsx';
import { Button } from '../components/ui/Button.jsx';
import { buttonClasses } from '../components/ui/buttonStyles.js';
import { sampleStudents } from '../data/sampleStudents.js';
import { appConfig } from '../config/app.js';
import { paths } from '../routes/paths.js';
import { formatDate } from '../utils/format.js';

const CAPABILITIES = [
  {
    icon: IdCard,
    title: 'Student IDs, handled',
    copy: 'Every record is issued a CampusDesk ID the moment it is created, so no one has to invent one.',
  },
  {
    icon: Search,
    title: 'Find anyone in seconds',
    copy: 'Search by name, ID, email or course and narrow the list by department, year and status.',
  },
  {
    icon: BadgeCheck,
    title: 'Enrollment at a glance',
    copy: 'Active and inactive students are always counted, never guessed from a spreadsheet.',
  },
  {
    icon: ShieldCheck,
    title: 'Secure by default',
    copy: 'Passwords are hashed, sessions are signed, and student data stays behind an authenticated API.',
  },
  {
    icon: CalendarClock,
    title: 'Full history',
    copy: 'Registration dates and record timestamps are kept, so enrolment numbers always reconcile.',
  },
  {
    icon: LayoutDashboard,
    title: 'A dashboard that reports',
    copy: 'Departments, year groups and recent registrations summarised the moment you sign in.',
  },
];

const STEPS = [
  {
    step: '01',
    title: 'Register the student',
    copy: 'Name, contact details, course, department and year — captured once, validated on both sides.',
  },
  {
    step: '02',
    title: 'Keep the record current',
    copy: 'Edit details, attach a photo, and move a student between active and inactive as terms change.',
  },
  {
    step: '03',
    title: 'Review and act',
    copy: 'Filter the register, export the numbers you need, and keep every department aligned.',
  },
];

const preview = sampleStudents.slice(0, 4);

export default function LandingPage() {
  const scopeRef = useRef(null);
  const prefersReducedMotion = useReducedMotion();

  /**
   * GSAP drives the entrance of the hero only — a single timeline that settles
   * the page, rather than animation scattered across every element.
   */
  useEffect(() => {
    if (prefersReducedMotion) return undefined;

    const context = gsap.context(() => {
      const timeline = gsap.timeline({ defaults: { ease: 'power3.out', duration: 0.75 } });

      timeline
        .from('[data-hero="mark"]', { y: 18, opacity: 0 })
        .from('[data-hero="title"] span', { y: 34, opacity: 0, stagger: 0.09 }, '-=0.45')
        .from('[data-hero="copy"]', { y: 16, opacity: 0 }, '-=0.5')
        .from('[data-hero="actions"] > *', { y: 14, opacity: 0, stagger: 0.08 }, '-=0.5')
        .from('[data-hero="panel"]', { y: 26, opacity: 0, duration: 0.9 }, '-=0.7')
        .from('[data-hero="panel-row"]', { x: 18, opacity: 0, stagger: 0.07 }, '-=0.6');
    }, scopeRef);

    return () => context.revert();
  }, [prefersReducedMotion]);

  return (
    <div ref={scopeRef} className="min-h-dvh bg-canvas">
      <header className="mx-auto flex w-full max-w-[1180px] items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
        <Logo tagline />

        <nav className="flex items-center gap-2">
          <Link
            to={paths.login}
            className={buttonClasses({ variant: 'ghost', size: 'sm' })}
          >
            Sign in
          </Link>
          <Link
            to={paths.dashboard}
            className={buttonClasses({ variant: 'primary', size: 'sm', className: 'hidden sm:inline-flex' })}
          >
            Open dashboard
          </Link>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-[1180px] px-4 pb-20 sm:px-6 lg:px-8">
        <section className="grid items-center gap-12 pt-10 pb-16 lg:grid-cols-[1.05fr_0.95fr] lg:pt-16">
          <div>
            <span
              data-hero="mark"
              className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-[12px] font-semibold text-charcoal shadow-card"
            >
              <span className="size-2 rounded-full bg-success" aria-hidden="true" />
              {appConfig.name} · {appConfig.tagline}
            </span>

            <h1
              data-hero="title"
              className="mt-5 text-[34px] leading-[1.08] font-extrabold tracking-tight text-ink sm:text-[44px] lg:text-[52px]"
            >
              <span className="block">Every student record,</span>
              <span className="block">on one calm desk.</span>
            </h1>

            <p data-hero="copy" className="mt-5 max-w-xl text-[15px] leading-relaxed text-muted sm:text-base">
              CampusDesk gives campus teams one place to register students, keep their details
              current and see enrolment at a glance — instead of chasing spreadsheets between
              departments.
            </p>

            <div data-hero="actions" className="mt-8 flex flex-wrap items-center gap-3">
              <Link to={paths.dashboard} className={buttonClasses({ size: 'lg' })}>
                Open the dashboard
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
              <Link
                to={paths.students}
                className={buttonClasses({ variant: 'secondary', size: 'lg' })}
              >
                Browse the register
              </Link>
            </div>

            <dl className="mt-10 grid max-w-lg grid-cols-3 gap-4 border-t border-line/70 pt-6">
              {[
                { label: 'Student fields', value: '9' },
                { label: 'Search + filters', value: 'Live' },
                { label: 'Records per page', value: '8' },
              ].map(({ label, value }) => (
                <div key={label}>
                  <dt className="text-[12px] font-medium tracking-wide text-muted uppercase">
                    {label}
                  </dt>
                  <dd className="mt-1 text-xl font-semibold text-ink">{value}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* A captured moment of the register, so the product is visible before signing in. */}
          <div data-hero="panel" className="relative">
            <div className="absolute -inset-4 -z-10 rounded-[32px] bg-beige/40" aria-hidden="true" />

            <div className="rounded-card border border-line/70 bg-surface p-4 shadow-raised sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[13px] font-semibold text-ink">Recent registrations</p>
                  <p className="text-[12px] text-muted">Computer Science · Autumn intake</p>
                </div>
                <StatusPill status="active" label="Live register" />
              </div>

              <ul className="mt-4 space-y-2.5">
                {preview.map((student) => (
                  <li
                    key={student.id}
                    data-hero="panel-row"
                    className="flex items-center gap-3 rounded-xl border border-line/60 bg-canvas/50 px-3 py-2.5"
                  >
                    <Avatar name={student.name} size="sm" />

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-ink">{student.name}</p>
                      <p className="truncate text-[12px] text-muted">
                        {student.studentId} · {student.department}
                      </p>
                    </div>

                    <span className="hidden text-[12px] text-muted sm:block">
                      {formatDate(student.dateOfRegistration)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section aria-labelledby="capabilities-title" className="pt-6">
          <h2 id="capabilities-title" className="text-[13px] font-semibold tracking-wider text-muted uppercase">
            What CampusDesk does
          </h2>

          <motion.ul
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.15 }}
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
            className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            {CAPABILITIES.map(({ icon: Icon, title, copy }) => (
              <motion.li
                key={title}
                variants={{
                  hidden: { opacity: 0, y: 16 },
                  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
                }}
                whileHover={{ y: -3 }}
                className="rounded-card border border-line/70 bg-surface p-5 shadow-card"
              >
                <span className="grid size-10 place-items-center rounded-xl bg-beige/60 text-charcoal">
                  <Icon className="size-[18px]" aria-hidden="true" />
                </span>
                <h3 className="mt-4 text-[15px] font-semibold text-ink">{title}</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{copy}</p>
              </motion.li>
            ))}
          </motion.ul>
        </section>

        <section aria-labelledby="workflow-title" className="pt-16">
          <h2 id="workflow-title" className="text-[13px] font-semibold tracking-wider text-muted uppercase">
            How a record moves through CampusDesk
          </h2>

          <ol className="mt-5 grid gap-4 md:grid-cols-3">
            {STEPS.map(({ step, title, copy }) => (
              <li key={step} className="rounded-card border border-line/70 bg-surface p-5 shadow-card">
                <span className="text-[12px] font-bold tracking-widest text-muted">{step}</span>
                <h3 className="mt-3 text-[15px] font-semibold text-ink">{title}</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{copy}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-16 overflow-hidden rounded-card bg-charcoal px-6 py-10 sm:px-10">
          <div className="flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-center">
            <div className="max-w-xl">
              <h2 className="text-[24px] leading-tight font-semibold text-canvas sm:text-[28px]">
                Ready to see the register?
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-canvas/70">
                Sign in to work with student records, or open the dashboard to see how enrolment is
                tracking across departments.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link to={paths.login} className={buttonClasses({ variant: 'soft', size: 'lg' })}>
                Sign in
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
              <Button
                variant="ghost"
                size="lg"
                className="text-canvas hover:bg-canvas/10"
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              >
                Back to top
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line/70 bg-surface">
        <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-3 px-4 py-6 text-[12px] text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <Logo size="sm" />
          <p>
            © {appConfig.year} Ashish Kumar · MIT licensed
          </p>
        </div>
      </footer>
    </div>
  );
}
