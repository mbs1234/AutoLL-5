import { AutopilotEvent } from '@/autopilot/events';
import { Time } from '@/components/Time';

const LEVEL_CLASS: Record<AutopilotEvent['level'], string> = {
  info: 'text-gray-800',
  warn: 'text-amber-800',
  error: 'text-red-700',
};

/** One line, time first: "11:43 AM — Booked Space Mountain for 1:10 PM". */
export default function LatestEvent({ event }: { event?: AutopilotEvent }) {
  if (!event) return null;
  return (
    <p
      className={`mt-3 mb-0 border-t border-gray-200 pt-3 text-sm font-semibold ${LEVEL_CLASS[event.level]}`}
    >
      {event.at && (
        <>
          <Time time={event.at} className="text-gray-500" /> &mdash;{' '}
        </>
      )}
      {event.text}
    </p>
  );
}
