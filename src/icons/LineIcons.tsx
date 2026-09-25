/**
 * The new look's line icons: drawn with a stroke rather than filled, on a
 * 24-unit grid, in the text colour of whatever holds them.
 *
 * Decorative only. Every one sits beside a word that already says what it
 * means, so each is hidden from assistive technology rather than given a name
 * that would be read twice.
 *
 * Shapes after Feather Icons by Cole Bemis, https://feathericons.com,
 * MIT License.
 */
function LineIcon({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={`shrink-0 ${className ?? 'size-5'}`}
    >
      {children}
    </svg>
  );
}

type Props = { className?: string };

export function SlidersIcon({ className }: Props) {
  return (
    <LineIcon className={className}>
      <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" />
    </LineIcon>
  );
}

export function CheckCircleIcon({ className }: Props) {
  return (
    <LineIcon className={className}>
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </LineIcon>
  );
}

export function LinesIcon({ className }: Props) {
  return (
    <LineIcon className={className}>
      <path d="M3 6h10M7 12h14M3 18h8" />
    </LineIcon>
  );
}

export function PulseIcon({ className }: Props) {
  return (
    <LineIcon className={className}>
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </LineIcon>
  );
}

export function SoundIcon({ className }: Props) {
  return (
    <LineIcon className={className}>
      <path d="M11 5 6 9H3v6h3l5 4V5z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M18.4 5.6a9 9 0 0 1 0 12.8" />
    </LineIcon>
  );
}

export function SunIcon({ className }: Props) {
  return (
    <LineIcon className={className}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </LineIcon>
  );
}

export function LockIcon({ className }: Props) {
  return (
    <LineIcon className={className}>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </LineIcon>
  );
}

export function PauseIcon({ className }: Props) {
  return (
    <LineIcon className={className}>
      <path d="M10 4H6v16h4zM18 4h-4v16h4z" />
    </LineIcon>
  );
}
