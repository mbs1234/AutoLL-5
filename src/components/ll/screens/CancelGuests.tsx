import { use, useId, useState } from 'react';

import { DasBooking, LightningLane } from '@/api/itinerary';
import { outcomeIsUnknown } from '@/autopilot/autobook';
import Button from '@/components/Button';
import FloatingButton from '@/components/FloatingButton';
import GuestList from '@/components/GuestList';
import LandLine from '@/components/LandLine';
import Overlay from '@/components/Overlay';
import Screen from '@/components/Screen';
import ClientsContext from '@/contexts/ClientsContext';
import NavContext from '@/contexts/NavContext';
import PlansContext from '@/contexts/PlansContext';
import { formatTime } from '@/datetime';
import useDataLoader from '@/hooks/useDataLoader';

import ReturnTime from '../ReturnTime';
import UnansweredNotice from '../UnansweredNotice';

export default function CancelGuests<B extends LightningLane | DasBooking>({
  booking,
  onCancel,
  dasGuest,
}: {
  booking: B;
  onCancel: (newGuests: B['guests']) => void;
  dasGuest?: B['guests'][0];
}) {
  const { goBack } = use(NavContext);
  const { ll, das } = use(ClientsContext);
  const client = booking.type === 'DAS' ? das : ll;
  const { refreshPlans } = use(PlansContext);
  const [guestsToCancel, setGuestsToCancel] = useState<
    Set<LightningLane['guests'][0]>
  >(new Set());
  const { loadData, loaderElem } = useDataLoader();
  const [unanswered, setUnanswered] = useState(false);
  // A cancel cannot be taken back, and the time may be gone if it is wanted
  // again, so the bottom button asks first and names what goes.
  const [confirming, setConfirming] = useState(false);
  const confirmTitleId = useId();

  const { name, park, guests } = booking;
  const cancelingNone = guestsToCancel.size === 0;
  const cancelingAll = guestsToCancel.size === guests.length;

  async function cancelBooking() {
    if (cancelingNone) return;
    let cancelled = false;
    await loadData(async () => {
      try {
        await client.cancelBooking([...guestsToCancel]);
        cancelled = true;
      } catch (error) {
        if (outcomeIsUnknown(error)) setUnanswered(true);
        throw error;
      } finally {
        // Either way. A cancel whose answer was lost may still have landed,
        // and a refused one must not leave Plans showing what it assumed.
        refreshPlans();
      }
    });
    // Only a cancel Disney confirmed leaves this screen. A failed one used to
    // go back anyway and redraw the party without those guests, so a refusal
    // read exactly like success -- with the error gone with the screen.
    if (!cancelled) return;
    await goBack();
    onCancel(guests.filter(g => !guestsToCancel.has(g)));
  }

  return (
    <Screen title="Cancel Guests" theme={park.theme}>
      <h2>{name}</h2>
      <LandLine land={booking.land} />
      <ReturnTime {...booking} />
      <div className="ml-3">
        <label className="flex items-center py-4">
          <input
            type="checkbox"
            checked={cancelingAll}
            onChange={() =>
              setGuestsToCancel(new Set(cancelingAll ? [] : guests))
            }
          />
          <span className="ml-3">Select All</span>
        </label>
      </div>
      {!cancelingNone && (
        <div className="mb-4">
          <h3>Cancel These Guests</h3>
          <GuestList
            guests={guests.filter(g => guestsToCancel.has(g))}
            selectable={{
              isSelected: () => true,
              onToggle: g => {
                if (
                  dasGuest &&
                  g !== dasGuest &&
                  guestsToCancel.has(dasGuest)
                ) {
                  setGuestsToCancel(new Set());
                } else {
                  const newGuests = new Set(guestsToCancel);
                  newGuests.delete(g);
                  setGuestsToCancel(newGuests);
                }
              },
            }}
          />
        </div>
      )}
      {!cancelingAll && (
        <div>
          <h3>Select Guests to Cancel</h3>
          <GuestList
            guests={guests.filter(g => !guestsToCancel.has(g))}
            selectable={{
              isSelected: () => false,
              onToggle: g => {
                setGuestsToCancel(
                  new Set(g === dasGuest ? guests : guestsToCancel).add(g)
                );
              },
            }}
          />
        </div>
      )}
      {unanswered && <UnansweredNotice action="cancel" />}
      <FloatingButton
        color="bg-red-700 text-white"
        disabled={cancelingNone || unanswered}
        onClick={() => setConfirming(true)}
      >
        {'Cancel ' + (cancelingAll ? 'Reservation' : 'Guests')}
      </FloatingButton>
      {confirming && (
        <Overlay>
          <div
            role="alertdialog"
            aria-labelledby={confirmTitleId}
            className="max-w-sm rounded-lg bg-white p-4 text-black"
          >
            <h3 id={confirmTitleId} className="mt-0 font-semibold">
              {cancelingAll
                ? `Cancel ${name}?`
                : `Cancel ${guestsToCancel.size} of ${guests.length} guests?`}
            </h3>
            <p className="mt-2 mb-0">
              {booking.start.time
                ? `${name} at ${formatTime(booking.start.time)}, for `
                : `${name}, for `}
              {[...guestsToCancel].map(g => g.name).join(', ')}. This cannot be
              undone, and the time may not come back.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button onClick={() => setConfirming(false)}>Keep it</Button>
              <Button
                color="bg-red-700 text-white"
                border="border border-transparent"
                onClick={() => {
                  setConfirming(false);
                  void cancelBooking();
                }}
              >
                Yes, cancel
              </Button>
            </div>
          </div>
        </Overlay>
      )}

      {loaderElem}
    </Screen>
  );
}
