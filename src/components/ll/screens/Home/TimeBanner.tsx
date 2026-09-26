import { Time } from '@/components/Time';
import { DateTime, ParkTime } from '@/datetime';

export default function TimeBanner({
  bookTime,
  dropTime,
}: {
  bookTime?: ParkTime;
  dropTime?: ParkTime;
}) {
  return bookTime || dropTime ? (
    <div className="flex gap-2">
      <LabeledTime label="Book again at" time={bookTime} />
      <LabeledTime label="Next scheduled drop" time={dropTime} />
    </div>
  ) : null;
}

function LabeledTime({ label, time }: { label?: string; time?: ParkTime }) {
  if (!time) return null;
  const now = DateTime.now().time.with({ second: 0 });
  return (
    // Label and time in one element, so each still reads "Book: 7:00 AM".
    <div className="flex-1 rounded-2xl border border-gray-300 bg-white px-3.5 py-2 text-xs font-bold tracking-wide text-gray-600 uppercase">
      {label}:{' '}
      {time > now ? (
        <Time
          time={time}
          className="block font-display text-2xl leading-tight tracking-tight text-ink normal-case [&_span_span]:text-sm"
        />
      ) : (
        <time
          dateTime={`${time}`}
          className="block font-display text-2xl leading-tight tracking-tight text-ink normal-case"
        >
          now
        </time>
      )}
    </div>
  );
}
