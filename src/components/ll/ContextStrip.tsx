import { use } from 'react';

import AutopilotContext from '@/contexts/AutopilotContext';
import BookingDateContext from '@/contexts/BookingDateContext';
import ParkContext from '@/contexts/ParkContext';
import { formatDate, parkDate } from '@/datetime';
import useSavedPartyCount from '@/hooks/useSavedPartyCount';

const DOT = <span aria-hidden>·</span>;

/**
 * The facts every Lightning Lane screen is about, on one line.
 *
 * Park, date, party size and whether this is a rehearsal, for a `Screen`'s
 * `subhead`, drawn as one chip in the park's colour. A pushed screen used to
 * show its title and nothing else, so two screens deep there was no saying
 * which park or day a decision was being made for.
 */
export default function ContextStrip() {
  const { park } = use(ParkContext);
  const { bookingDate } = use(BookingDateContext);
  const { dryRun } = use(AutopilotContext);
  const partySize = useSavedPartyCount();
  const day =
    bookingDate === parkDate() ? 'Today' : formatDate(bookingDate, 'short');

  return (
    <div className="self-start inline-flex flex-wrap items-center gap-x-1.5 min-h-9 rounded-[18px] bg-accent/12 px-3.5 py-1 text-sm font-bold text-accent">
      <span>{park.name}</span>
      {DOT}
      <time dateTime={bookingDate}>{day}</time>
      {DOT}
      <span>
        {partySize > 0 ? `Party of ${partySize}` : 'Everyone eligible'}
      </span>
      {dryRun && (
        <>
          {DOT}
          <span className="rounded-full bg-yellow-200 px-2 text-yellow-900">
            Dry run
          </span>
        </>
      )}
    </div>
  );
}
