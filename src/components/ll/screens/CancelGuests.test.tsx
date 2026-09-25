import { booking, ll, mickey, pluto, renderResort } from '@/__fixtures__/ll';
import { RequestError } from '@/api/client';
import { click, loading, nav, screen, see } from '@/testing';

import CancelGuests from './CancelGuests';

jest.useFakeTimers();

const { guests } = booking;
const onCancel = jest.fn();

function renderComponent() {
  renderResort(<CancelGuests booking={booking} onCancel={onCancel} />);
}

describe('CancelGuests', () => {
  beforeEach(() => {
    onCancel.mockClear();
    nav.goBack.mockClear();
  });

  it('cancels reservation', async () => {
    renderComponent();
    click('Select All');
    click('Cancel Reservation');
    click('Yes, cancel');
    expect(ll.cancelBooking).toHaveBeenLastCalledWith(guests);
    await loading();
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('cancels selected guests', async () => {
    renderComponent();
    click(mickey.name);
    click(pluto.name);
    click('Cancel Guests');
    click('Yes, cancel');
    expect(ll.cancelBooking).toHaveBeenLastCalledWith([guests[0], guests[2]]);
    await loading();
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('shows error on failure', async () => {
    renderComponent();
    ll.cancelBooking.mockRejectedValueOnce(
      new RequestError({ ok: false, status: 0, data: {} })
    );
    click('Select All');
    click('Cancel Reservation');
    click('Yes, cancel');
    await loading();
    see('Network request failed (no response)');
  });

  // It fired on the first tap: a cancel cannot be taken back.
  it('asks first, and names what would go', () => {
    renderComponent();
    click(mickey.name);
    click('Cancel Guests');
    expect(ll.cancelBooking).not.toHaveBeenCalledWith([guests[0]]);
    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveTextContent(`Cancel 1 of ${guests.length} guests?`);
    expect(dialog).toHaveTextContent(`${booking.name} at`);
    expect(dialog).toHaveTextContent(mickey.name);
    click('Keep it');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(ll.cancelBooking).not.toHaveBeenCalledWith([guests[0]]);
  });

  // It used to go back and redraw the party without those guests whatever
  // Disney said, so a refused cancel read exactly like a successful one.
  it('stays on the screen, guests unchanged, when Disney refuses', async () => {
    renderComponent();
    ll.cancelBooking.mockRejectedValueOnce(
      new RequestError({ ok: false, status: 400, data: {} })
    );
    click('Select All');
    click('Cancel Reservation');
    click('Yes, cancel');
    await loading();
    expect(onCancel).not.toHaveBeenCalled();
    expect(nav.goBack).not.toHaveBeenCalled();
    see.no('Disney did not answer.');
  });

  it('says the outcome is unknown when Disney does not answer', async () => {
    renderComponent();
    ll.cancelBooking.mockRejectedValueOnce(
      new RequestError({ ok: false, status: 0, data: {} })
    );
    click('Select All');
    click('Cancel Reservation');
    click('Yes, cancel');
    await loading();
    see('Disney did not answer.');
    expect(see('Cancel Reservation')).toBeDisabled();
    expect(onCancel).not.toHaveBeenCalled();
    expect(nav.goBack).not.toHaveBeenCalled();
  });
});
