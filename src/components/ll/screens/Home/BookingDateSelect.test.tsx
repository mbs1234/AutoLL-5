import { renderResort } from '@/__fixtures__/resort';
import { AutopilotState } from '@/contexts/AutopilotContext';
import BookingDateContext from '@/contexts/BookingDateContext';
import TopAutopilotContext from '@/contexts/TopAutopilotContext';
import { modifyDate, parkDate } from '@/datetime';
import { click, screen } from '@/testing';

import BookingDateSelect from './BookingDateSelect';

// Building a trip day by day meant opening each day to find out what was on
// it. A day with a plan saved for it, or a pass held, is marked.
describe('BookingDateSelect', () => {
  it('marks the days that already have a plan', () => {
    const planned = modifyDate(parkDate(), 3);
    renderResort(
      <BookingDateContext
        value={{ bookingDate: parkDate(), setBookingDate: () => undefined }}
      >
        <TopAutopilotContext
          value={
            {
              targets: [{ experienceId: 'ride', date: planned }],
              targetsHere: [],
              enabled: false,
            } as unknown as AutopilotState
          }
        >
          <BookingDateSelect />
        </TopAutopilotContext>
      </BookingDateContext>
    );
    click(screen.getByTitle('Booking Date'));
    const cell = (date: string) =>
      document.querySelector(`time[datetime="${date}"]`)!.closest('label')!;
    expect(cell(planned)).toHaveTextContent('(has a plan or pass)');
    expect(cell(modifyDate(parkDate(), 4))).not.toHaveTextContent('has a plan');
  });
});
