import { use } from 'react';

import { renderResort, ep as wdwEp, mk as wdwMk } from '@/__fixtures__/resort';
import { Park } from '@/api/resort';
import AutopilotContext from '@/contexts/AutopilotContext';
import BookingDateContext from '@/contexts/BookingDateContext';
import ParkContext from '@/contexts/ParkContext';
import { formatDate, modifyDate, parkDate } from '@/datetime';
import { PARTY_IDS_KEY } from '@/hooks/useSavedParty';
import kvdb from '@/kvdb';
import { click, nav, render, screen, see, within } from '@/testing';

import ContextStrip from './ContextStrip';
import PartySelector from './screens/PartySelector';

const mk = { name: 'Magic Kingdom' } as Park;
const today = parkDate();

function DryRun({ children }: { children: React.ReactNode }) {
  const state = use(AutopilotContext);
  return (
    <AutopilotContext value={{ ...state, dryRun: true }}>
      {children}
    </AutopilotContext>
  );
}

function renderStrip({ date = today, dryRun = false } = {}) {
  const strip = (
    <ParkContext value={{ park: mk, setPark: () => undefined }}>
      <BookingDateContext
        value={{ bookingDate: date, setBookingDate: () => undefined }}
      >
        <ContextStrip />
      </BookingDateContext>
    </ParkContext>
  );
  return render(dryRun ? <DryRun>{strip}</DryRun> : strip);
}

describe('ContextStrip', () => {
  beforeEach(() => kvdb.delete(PARTY_IDS_KEY));

  it('names the park and calls today today', () => {
    renderStrip();
    see('Magic Kingdom');
    see('Today');
  });

  it('names another date by its day', () => {
    const date = modifyDate(today, 3);
    renderStrip({ date });
    see(formatDate(date, 'short'));
    see.no('Today');
  });

  it('counts the saved party, and says so when there is none', () => {
    const { unmount } = renderStrip();
    see('Everyone eligible');
    unmount();
    kvdb.set(PARTY_IDS_KEY, ['mickey', 'minnie', 'pluto']);
    renderStrip();
    see('Party of 3');
  });

  it('flags a dry run only while one is on', () => {
    const { unmount } = renderStrip();
    see.no('Dry run');
    unmount();
    renderStrip({ dryRun: true });
    see('Dry run');
  });
});

// The chip was the most visible thing on Today and did nothing when tapped;
// Party Selection was only in the gear menu.
describe('ContextStrip, as the control for park, day and party', () => {
  function renderControl() {
    const setPark = jest.fn();
    renderResort(
      <nav.Provider>
        <ParkContext value={{ park: wdwMk, setPark }}>
          <BookingDateContext
            value={{ bookingDate: today, setBookingDate: () => undefined }}
          >
            <ContextStrip interactive />
          </BookingDateContext>
        </ParkContext>
      </nav.Provider>
    );
    return { setPark };
  }

  it('opens the park, the day and the party together', () => {
    renderControl();
    click(screen.getByTitle('Park, day and party'));
    const sheet = screen.getByRole('dialog', { name: 'Park, day and party' });
    expect(within(sheet).getByTitle('Park')).toBeVisible();
    expect(within(sheet).getByText('Party')).toBeVisible();
  });

  it('changes the park from the sheet', () => {
    const { setPark } = renderControl();
    click(screen.getByTitle('Park, day and party'));
    click(within(screen.getByRole('dialog')).getByTitle('Park'));
    click(wdwEp.name, 'radio');
    expect(setPark).toHaveBeenCalledWith(wdwEp);
  });

  it('opens Party Selection from the sheet', () => {
    nav.goTo.mockClear();
    renderControl();
    click(screen.getByTitle('Park, day and party'));
    click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Change' })
    );
    expect(nav.goTo).toHaveBeenCalledWith(<PartySelector />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('stays a plain chip on a pushed screen', () => {
    renderStrip();
    expect(screen.queryByTitle('Park, day and party')).not.toBeInTheDocument();
  });
});
