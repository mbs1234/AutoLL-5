import { booking } from '@/__fixtures__/ll';
import RebookingContext from '@/contexts/RebookingContext';
import TabsContext from '@/contexts/TabContext';
import { click, render, screen } from '@/testing';

import RebookingStrip from './RebookingStrip';

function renderStrip({ tab = 'Today', auto = false } = {}) {
  const end = jest.fn();
  const active = { name: tab, icon: null, component: () => null };
  render(
    <TabsContext
      value={{
        tabs: [active],
        active,
        changeTab: () => {},
        scrollPos: { get: () => 0, set: () => {} },
      }}
    >
      <RebookingContext
        value={{ current: booking, auto, begin: jest.fn(), end }}
      >
        <RebookingStrip />
      </RebookingContext>
    </TabsContext>
  );
  return { end };
}

// Modify mode stayed on across tabs with no word outside the LL tab, and
// hours later a "new" booking replaced the held pass.
describe('RebookingStrip', () => {
  it('says what is being modified, with a way out, on every tab', () => {
    const { end } = renderStrip();
    expect(screen.getByRole('status')).toHaveTextContent(
      `Modifying ${booking.name}`
    );
    click('Keep current');
    expect(end).toHaveBeenCalled();
  });

  it('leaves the LL tab to its own header', () => {
    renderStrip({ tab: 'LL' });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('says nothing for a modify Autopilot itself started', () => {
    renderStrip({ auto: true });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
