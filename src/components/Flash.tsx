export type FlashType = 'alert' | 'error';

const COLORS = { alert: 'bg-yellow-200', error: 'bg-red-200' };

export default function Flash({
  message,
  type,
  at,
  onDismiss,
}: {
  message: string;
  type: FlashType;
  /** When it happened, for a message that stays: "2:14 PM". */
  at?: string;
  /** Present for a message that stays until it is dismissed. */
  onDismiss?: () => void;
}) {
  return message ? (
    <div
      role="alert"
      className={`fixed bottom-20 left-0 flex w-full items-center justify-center gap-2 p-2 font-semibold text-center ${COLORS[type]} text-gray-800`}
    >
      <span>
        {at && <span className="font-normal">{at} &mdash; </span>}
        {message}
      </span>
      {onDismiss && (
        <button
          aria-label="Dismiss"
          className="-my-2 min-h-11 min-w-11 shrink-0 text-lg leading-none"
          onClick={onDismiss}
        >
          ×
        </button>
      )}
    </div>
  ) : null;
}
