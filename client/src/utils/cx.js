/** Join class names, dropping anything falsy. */
export const cx = (...classes) => classes.filter(Boolean).join(' ');
