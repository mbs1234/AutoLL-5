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
    <div className="flex justify-center gap-x-8 rounded-xl border border-gray-300 bg-white py-1.5 font-semibold text-ink">
      <LabeledTime label="Book" time={bookTime} />
      <LabeledTime label="Drop" time={dropTime} />
    </div>
  ) : null;
}

function LabeledTime({ label, time }: { label?: string; time?: ParkTime }) {
  if (!time) return null;
  const now = DateTime.now().time.with({ second: 0 });
  return (
    <div>
      {label}:{' '}
      {time > now ? (
        <Time time={time} />
      ) : (
        <time dateTime={`${time}`}>now</time>
      )}
    </div>
  );
}
