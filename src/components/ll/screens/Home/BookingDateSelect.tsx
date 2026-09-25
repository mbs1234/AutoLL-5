import { use, useMemo } from 'react';

import { isLLMP } from '@/api/itinerary';
import MenuButton, { MenuProps } from '@/components/MenuButton';
import BookingDateContext from '@/contexts/BookingDateContext';
import PlansContext from '@/contexts/PlansContext';
import ThemeContext from '@/contexts/ThemeContext';
import TopAutopilotContext from '@/contexts/TopAutopilotContext';
import { DateFormat, modifyDate, parkDate, toDate } from '@/datetime';
import useUpdateParkFromPlans from '@/hooks/useUpdateParkFromPlans';
import { NUM_BOOKING_DAYS } from '@/providers/BookingDateProvider';

import useScopeGuard, { dayLabel } from '../../useScopeGuard';

export default function BookingDateSelect(props: { className?: string }) {
  const { bookingDate, setBookingDate } = use(BookingDateContext);
  const updateParkFromPlans = useUpdateParkFromPlans();
  const { guard, dialog } = useScopeGuard();
  const today = parkDate();
  // Days that already have something on them -- a plan saved for the date, or
  // a Multi Pass held -- marked in the calendar, so building a trip day by day
  // does not mean opening each one to find out.
  const targets = use(TopAutopilotContext)?.targets;
  const { plans } = use(PlansContext);
  const marked = useMemo(() => {
    const dates = new Set<string>();
    for (const target of targets ?? []) {
      if (target.date) dates.add(target.date);
    }
    for (const booking of plans) {
      if (isLLMP(booking)) dates.add(parkDate(booking.start));
    }
    return dates;
  }, [targets, plans]);
  const Calendar = useMemo(
    () =>
      function MarkedCalendar<K extends string, V>(props: MenuProps<K, V>) {
        return <CalendarMenu {...props} marked={marked} />;
      },
    [marked]
  );

  const options = useMemo(() => {
    return new Map(
      [...Array(NUM_BOOKING_DAYS).keys()].map(i => {
        const date = modifyDate(today, i);
        const [m, d] = date.split('-').slice(1).map(Number);
        const buttonText = date === today ? 'Today' : `${m}/${d}`;
        const text = `${d}`;
        return [date, { buttonText, text }];
      })
    );
  }, [today]);

  return (
    <>
      <MenuButton
        {...props}
        title="Booking Date"
        options={options}
        selected={bookingDate}
        onChange={(date: string) => {
          if (date === bookingDate) return;
          guard(dayLabel(date), () => {
            setBookingDate(date);
            updateParkFromPlans(date);
          });
        }}
        menuType={Calendar}
      />
      {dialog}
    </>
  );
}

function CalendarMenu<K extends string, V>(
  props: MenuProps<K, V> & { marked?: Set<string> }
) {
  const { bg } = use(ThemeContext);
  const { options, selected, marked } = props;
  const dates = [...options.keys()];
  const bookStart = toDate(dates[0] as K);
  const calStart = modifyDate(bookStart, -bookStart.getDay());
  const monthFmt = new DateFormat({ month: 'long' });
  const startMonth = monthFmt.format(bookStart);
  const endMonth = monthFmt.format(dates[dates.length - 1] as K);
  const numWeeks = Math.ceil(options.size / 7);

  return (
    <div className="px-1 pb-1">
      <h4 className="mt-3 text-lg text-center">
        {startMonth === endMonth ? (
          startMonth
        ) : (
          <>
            {startMonth} – {endMonth}
          </>
        )}
      </h4>
      <table className="table-fixed border-separate border-spacing-0.5 w-full mt-2 font-semibold">
        <thead>
          <tr>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <th
                className="text-xs font-semibold uppercase text-center text-gray-500"
                key={d}
              >
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[...Array(numWeeks).keys()].map(weekIdx => (
            <tr key={weekIdx}>
              {[...Array(7).keys()].map(dayIdx => {
                const date = modifyDate(calStart, weekIdx * 7 + dayIdx);
                const opt = options.get(date as K);
                return opt ? (
                  <td className="p-0" key={dayIdx}>
                    <label className={`block p-2 ${bg} text-white`}>
                      <span
                        className={`flex items-center justify-center border-y-4 border-transparent has-checked:border-white py-0.5`}
                      >
                        <input
                          type="radio"
                          name="bookingDate"
                          value={date}
                          defaultChecked={date === selected}
                          className="fixed opacity-0 pointer-events-none"
                        />
                        <time dateTime={date}>{opt.text}</time>
                      </span>
                      <span
                        aria-hidden
                        className={`mx-auto block size-1.5 rounded-full ${marked?.has(date) ? 'bg-white' : 'bg-transparent'}`}
                      />
                      {marked?.has(date) && (
                        <span className="sr-only"> (has a plan or pass)</span>
                      )}
                    </label>
                  </td>
                ) : (
                  <td key={dayIdx} />
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
