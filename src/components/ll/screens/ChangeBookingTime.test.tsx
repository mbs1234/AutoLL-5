import { booking, ll, modOffer, renderResort, times } from '@/__fixtures__/ll';
import { click, loading, nav, see, waitFor } from '@/testing';

import BookNewReturnTime from './BookNewReturnTime';
import ChangeBookingTime from './ChangeBookingTime';

ll.offer.mockResolvedValue(modOffer);
jest.useFakeTimers();
const { Provider: NavProvider, goTo } = nav;

describe('ChangeBookingTime', () => {
  it('allows changing booking return time', async () => {
    renderResort(
      <NavProvider>
        <ChangeBookingTime booking={booking} />
      </NavProvider>
    );
    await see.screen('Select Return Time');
    expect(ll.offer).toHaveBeenCalledWith(booking.experience, booking.guests, {
      booking,
    });
    expect(ll.offer).toHaveBeenCalledTimes(1);
    await loading();
    const newOffer = { ...modOffer, id: 'new-offer' };
    ll.changeOfferTime.mockResolvedValueOnce(newOffer);
    click(see.time(times[1]![1]));
    await waitFor(() =>
      expect(goTo).toHaveBeenCalledWith(<BookNewReturnTime offer={newOffer} />)
    );
  });

  // The screen shown until the offer arrives, and for good if it never does.
  // Refresh did nothing and Keep had no action, so one failed request left
  // this screen with no way forward but the header's back arrow.
  describe('when the offer does not come', () => {
    function renderFailed() {
      ll.offer.mockClear();
      ll.offer.mockRejectedValueOnce(new Error('no answer'));
      renderResort(
        <NavProvider>
          <ChangeBookingTime booking={booking} />
        </NavProvider>
      );
    }

    it('asks again on Refresh', async () => {
      renderFailed();
      await loading();
      expect(ll.offer).toHaveBeenCalledTimes(1);
      click('Refresh Times');
      await waitFor(() => expect(ll.offer).toHaveBeenCalledTimes(2));
    });

    it('goes back on Keep current', async () => {
      renderFailed();
      await loading();
      nav.goBack.mockClear();
      click('Keep current');
      await waitFor(() => expect(nav.goBack).toHaveBeenCalled());
    });
  });
});
