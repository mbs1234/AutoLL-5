import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';

import { syncedParkTime } from '@/autopilot/schedule';
import { AutopilotState } from '@/contexts/AutopilotContext';
import TabsContext from '@/contexts/TabContext';
import TopAutopilotContext from '@/contexts/TopAutopilotContext';

import AutopilotStatusRow from './AutopilotStatusRow';

const state: AutopilotState = {
  enabled: true,
  setEnabled: () => {},
  status: { mode: 'approach', consecutiveFailures: 0, polls: 8 },
  targets: [],
  targetsHere: [{ experienceId: 'ride', autoBook: true }],
  isWatched: () => false,
  addTarget: () => {},
  removeTarget: () => {},
  replaceTargets: () => {},
  toggleAutoBook: () => {},
  toggleAutoModify: () => {},
  toggleBookThenMove: () => {},
  togglePaused: () => {},
  toggleAutoSwap: () => {},
  setTargetWindow: () => {},
  setTargetRank: () => {},
  togglePasskey: () => {},
  passkeyStatus: 'off',
  notifications: 'granted',
  requestNotifications: () => {},
  bookingLog: [],
  sessionLog: [],
  bookedCount: 0,
  requireWholeParty: false,
  setRequireWholeParty: () => {},
  dryRun: false,
  setDryRun: () => {},
  avoidOverlaps: true,
  setAvoidOverlaps: () => {},
  skipCounts: {},
  dropSummaries: [],
};

function setup(active = 'LL', overrides: Partial<AutopilotState> = {}) {
  const changeTab = jest.fn();
  render(
    <TabsContext
      value={{
        tabs: [],
        active: { name: active, icon: null, component: () => null },
        changeTab,
        scrollPos: { get: () => 0, set: () => {} },
      }}
    >
      <TopAutopilotContext value={{ ...state, ...overrides }}>
        <AutopilotStatusRow />
      </TopAutopilotContext>
    </TabsContext>
  );
  return changeTab;
}

describe('AutopilotStatusRow', () => {
  it('summarises the day plan and opens Today', () => {
    const changeTab = setup();
    const row = screen.getByRole('button', { name: /Autopilot:/ });
    expect(row).toHaveTextContent('Checking often · 1 armed');
    fireEvent.click(row);
    expect(changeTab).toHaveBeenCalledWith('Today');
  });

  // It stayed green when the run had stopped, so from every tab but Today a
  // dead run looked like a live one.
  it('turns red, in words as well as colour, once stopped', () => {
    setup('LL', {
      status: { mode: 'stopped', consecutiveFailures: 8, polls: 40 },
    });
    const row = screen.getByRole('button', { name: /Autopilot:/ });
    expect(row).toHaveTextContent('Stopped after repeated errors');
    expect(row).toHaveClass('text-red-700');
    expect(row.querySelector('[aria-hidden]')).toHaveClass('bg-red-700');
  });

  it('says when Disney is refusing its calls', () => {
    const since = syncedParkTime().add({ minutes: -5 });
    setup('LL', { refusals: { book: { count: 5, since } } });
    const row = screen.getByRole('button', { name: /Autopilot:/ });
    expect(row).toHaveTextContent('Disney refusing');
    expect(row.querySelector('[aria-hidden]')).toHaveClass('bg-amber-600');
  });

  it('marks nothing armed, since then it can only alert', () => {
    setup('LL', { targetsHere: [{ experienceId: 'ride' }] });
    expect(screen.getByText('0 armed')).toHaveClass('text-amber-800');
  });

  it('stays out of Today, where the full controls are already shown', () => {
    setup('Today');
    expect(
      screen.queryAllByRole('button', { name: /Autopilot:/ })
    ).toHaveLength(0);
  });
});
