import ReturnWindow from './ReturnWindow';

export default function ReturnTime({
  start,
  end,
  button,
}: Parameters<typeof ReturnWindow>[0] & { button?: React.ReactNode }) {
  return (
    <div className="mt-4">
      <div className="flex items-center gap-x-3">
        {/* The window is the thing this screen is for, so it is the biggest
            thing on it, in the display face; the label and the window are one
            element still, which reads "Arrive by: 10:35 AM – 11:35 AM". */}
        <div className="min-w-0 flex-1">
          <span className="block text-xs font-bold tracking-wide text-gray-600 uppercase">
            {end ? 'Arrive by' : 'Reservation at'}:
          </span>{' '}
          <span className="block font-display text-xl leading-tight font-semibold tracking-tight text-ink [&_time_span_span]:text-sm">
            <ReturnWindow start={start} end={end} />
          </span>
        </div>
        <div>{button}</div>
      </div>
    </div>
  );
}
