import { use, useId, useState } from 'react';

import Button from '@/components/Button';
import Overlay from '@/components/Overlay';
import AutopilotContext from '@/contexts/AutopilotContext';
import BookingDateContext from '@/contexts/BookingDateContext';
import ClientsContext from '@/contexts/ClientsContext';
import NavContext from '@/contexts/NavContext';
import ParkContext from '@/contexts/ParkContext';
import { formatDate, parkDate } from '@/datetime';
import useSavedPartyCount from '@/hooks/useSavedPartyCount';

import BookingDateSelect from './screens/Home/BookingDateSelect';
import ParkSelect from './screens/Home/ParkSelect';
import PartySelector from './screens/PartySelector';

const DOT = <span aria-hidden>·</span>;

const CHIP =
  'self-start inline-flex flex-wrap items-center gap-x-1.5 min-h-9 rounded-[18px] bg-accent/12 px-3.5 py-1 text-sm font-bold text-accent';

/**
 * The facts every Lightning Lane screen is about, on one line.
 *
 * Park, date, party size and whether this is a rehearsal, for a `Screen`'s
 * `subhead`, drawn as one chip in the park's colour. A pushed screen used to
 * show its title and nothing else, so two screens deep there was no saying
 * which park or day a decision was being made for.
 *
 * `interactive` makes it the control for all three, on the tabs where changing
 * them is the point: a tap opens the park, the day and the party together.
 * Party Selection was otherwise only in the gear menu. A pushed screen keeps
 * the plain chip: it is about one park and day already.
 */
export default function ContextStrip({
  interactive = false,
}: {
  interactive?: boolean;
}) {
  const [open, setOpen] = useState(false);
  if (!interactive) {
    return (
      <div className={CHIP}>
        <ChipText />
      </div>
    );
  }
  return (
    <>
      <button
        className={CHIP}
        aria-haspopup="dialog"
        title="Park, day and party"
        onClick={() => setOpen(true)}
      >
        <ChipText />
        <span aria-hidden className="text-xs">
          ▾
        </span>
      </button>
      {open && <ScopeSheet onClose={() => setOpen(false)} />}
    </>
  );
}

function ChipText() {
  const { park } = use(ParkContext);
  const { bookingDate } = use(BookingDateContext);
  const { dryRun } = use(AutopilotContext);
  const partySize = useSavedPartyCount();
  const day =
    bookingDate === parkDate() ? 'Today' : formatDate(bookingDate, 'short');
  return (
    <>
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
    </>
  );
}

/**
 * The park, the day and the party, with a way to change each.
 *
 * The pickers are the header's own, so a switch that would move a running
 * Autopilot asks first here exactly as it does there.
 */
function ScopeSheet({ onClose }: { onClose: () => void }) {
  const { park } = use(ParkContext);
  const { bookingDate } = use(BookingDateContext);
  const { ll } = use(ClientsContext);
  const { goTo } = use(NavContext);
  const partySize = useSavedPartyCount();
  const titleId = useId();
  const day =
    bookingDate === parkDate() ? 'Today' : formatDate(bookingDate, 'short');
  const row = 'flex min-h-11 items-center justify-between gap-3';
  return (
    <Overlay
      onClick={event => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-labelledby={titleId}
        className="w-full max-w-sm rounded-lg bg-white p-4 text-black"
      >
        <h3 id={titleId} className="mt-0 font-semibold">
          Park, day and party
        </h3>
        <div className="mt-3 flex flex-col gap-2 text-sm">
          <div className={row}>
            <span>
              <span className="block text-xs text-gray-600">Park</span>
              <span className="font-semibold">{park.name}</span>
            </span>
            <ParkSelect />
          </div>
          {ll.rules.prebook && (
            <div className={row}>
              <span>
                <span className="block text-xs text-gray-600">Day</span>
                <span className="font-semibold">{day}</span>
              </span>
              <BookingDateSelect />
            </div>
          )}
          <div className={row}>
            <span>
              <span className="block text-xs text-gray-600">Party</span>
              <span className="font-semibold">
                {partySize > 0 ? `Party of ${partySize}` : 'Everyone eligible'}
              </span>
            </span>
            <Button
              onClick={() => {
                onClose();
                goTo(<PartySelector />);
              }}
            >
              Change
            </Button>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={onClose}>Done</Button>
        </div>
      </div>
    </Overlay>
  );
}
