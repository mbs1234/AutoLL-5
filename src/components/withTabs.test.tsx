import { use, useEffect } from 'react';

import TabsContext from '@/contexts/TabContext';
import { click, nav, render, screen } from '@/testing';

import withTabs from './withTabs';

const tab = (name: string) => ({ name, icon: null, component: () => null });

/** A tab body that holds any change until told otherwise. */
function Guarded({ hold }: { hold: boolean }) {
  const { setLeaveGuard, changeTab, active } = use(TabsContext);
  useEffect(() => {
    if (!hold) return;
    setLeaveGuard?.((_to, leave) => {
      (window as unknown as { leave?: () => void }).leave = leave;
      return true;
    });
    return () => setLeaveGuard?.(undefined);
  }, [hold, setLeaveGuard]);
  return (
    <>
      <p>On {active.name}</p>
      <button onClick={() => changeTab('B')}>Go to B</button>
    </>
  );
}

function renderTabs(hold: boolean) {
  const Tabbed = withTabs({ tabs: [tab('A'), tab('B')], footer: null }, () => (
    <Guarded hold={hold} />
  ));
  nav.goTo.mockClear();
  render(
    <nav.Provider>
      <Tabbed tabName="A" />
    </nav.Provider>
  );
}

// A running NextLL search stops when its tab is left, and a tap on a tab or
// the footer row used to leave it with no word. A screen with work to lose
// sets a guard; the change waits on the person.
describe('withTabs', () => {
  it('changes tab at once with no guard set', () => {
    renderTabs(false);
    click('Go to B');
    expect(nav.goTo).toHaveBeenCalledTimes(1);
  });

  it('holds the change for a guard, and makes it when it says leave', () => {
    renderTabs(true);
    click('Go to B');
    expect(nav.goTo).not.toHaveBeenCalled();
    (window as unknown as { leave: () => void }).leave();
    expect(nav.goTo).toHaveBeenCalledTimes(1);
    expect(screen.getByText('On A')).toBeInTheDocument();
  });
});
