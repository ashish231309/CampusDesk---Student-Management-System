const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

const relativeFormatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

export const formatDate = (value) => {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : dateFormatter.format(date);
};

/** "3 days ago" / "in 2 months" — used for recent activity lines. */
export const formatRelative = (value) => {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  const days = Math.round((date.getTime() - Date.now()) / 86_400_000);
  if (Math.abs(days) < 1) return 'today';
  if (Math.abs(days) < 30) return relativeFormatter.format(days, 'day');
  return relativeFormatter.format(Math.round(days / 30), 'month');
};

export const getInitials = (name = '') =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || '?';

export const formatCount = (value) => new Intl.NumberFormat('en-GB').format(value ?? 0);

export const titleCase = (value = '') => value.charAt(0).toUpperCase() + value.slice(1);
