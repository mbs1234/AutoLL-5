import { use } from 'react';

import AutopilotContext, { AutopilotState } from '@/contexts/AutopilotContext';
import TabsContext from '@/contexts/TabContext';
import { fireEvent, render, screen } from '@/testing';

import AutopilotButton from './AutopilotButton';

/** The default context, with a scenario's fields laid on top. */
function State({
  state,
  children,
}: {
  state: Partial<AutopilotState>;
  children: React.ReactNode;
}) {
  const real = use(AutopilotContext);
  return (
    <AutopilotContext value={{ ...real, ...state }}>
      {children}
    </AutopilotContext>
  );
}

function setup(state: Partial<AutopilotState> = {}) {
  const changeTab = jest.fn();
  render(
    <TabsContext
      value={{
        tabs: [],
        active: { name: 'LL', icon: null, component: () => null },
        changeTab,
        scrollPos: { get: () => 0, set: () => {} },
      }}
    >
      <State state={state}>
        <AutopilotButton />
      </State>
    </TabsContext>
  );
  return { changeTab, button: screen.getByRole('button') };
}

const idle = { mode: 'idle' as const, consecutiveFailures: 0, polls: 3 };

describe('AutopilotButton', () => {
  it('switches to the Today tab, where the switch is', () => {
    const { changeTab, button } = setup();
    fireEvent.click(button);
    expect(changeTab).toHaveBeenCalledWith('Today');
  });

  it('says it is off, in grey', () => {
    const { button } = setup();
    expect(button).toHaveAttribute('title', 'Autopilot off');
    expect(button.className).not.toMatch(/green|yellow|red/);
  });

  it('says it is running, counts what is armed, and goes green', () => {
    const { button } = setup({
      enabled: true,
      status: idle,
      targetsHere: [
        { experienceId: 'a', autoBook: true },
        { experienceId: 'b', autoModify: true },
        { experienceId: 'c' },
      ],
    });
    expect(button).toHaveAttribute('title', 'Autopilot on, 2 armed');
    expect(button).toHaveTextContent('2');
    expect(button).toHaveClass('bg-green-700');
  });

  it('is yellow for a dry run and red once stopped', () => {
    const rehearsing = setup({
      enabled: true,
      status: idle,
      dryRun: true,
      targetsHere: [{ experienceId: 'a', autoBook: true }],
    });
    expect(rehearsing.button).toHaveClass('bg-yellow-600');
    expect(rehearsing.button).toHaveAttribute(
      'title',
      'Autopilot on (dry run), 1 armed'
    );
  });

  // It showed no count at zero, the one count that means it can only alert.
  it('shows 0, in amber, when nothing is armed', () => {
    const { button } = setup({
      enabled: true,
      status: idle,
      targetsHere: [{ experienceId: 'a' }],
    });
    expect(button).toHaveTextContent('0');
    expect(button).toHaveClass('bg-amber-600');
  });

  it('asks for attention once the poller has stopped', () => {
    const { button } = setup({
      enabled: true,
      status: { mode: 'stopped', consecutiveFailures: 5, polls: 9 },
    });
    expect(button).toHaveClass('bg-red-700');
    expect(button).toHaveAttribute('title', 'Autopilot stopped after errors');
  });
});
