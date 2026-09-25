import { use } from 'react';

import { MODE_TEXT } from '@/autopilot/status';
import { targetActs } from '@/autopilot/watchlist';
import TabsContext from '@/contexts/TabContext';
import TopAutopilotContext from '@/contexts/TopAutopilotContext';

/**
 * A compact, tappable day-plan summary for tabs other than Today.
 *
 * The actual on/off control remains on Today. This is deliberately navigation
 * only: a footer mis-tap should never change booking behaviour.
 */
export default function AutopilotStatusRow() {
  const autopilot = use(TopAutopilotContext);
  const { active, changeTab } = use(TabsContext);

  if (!autopilot?.enabled || active.name === 'Today') return null;

  const armed = autopilot.targetsHere.filter(
    target => targetActs(target) && !target.paused
  ).length;
  return (
    <button
      className="w-full border-t border-gray-200 bg-gray-50 px-3 py-1.5 text-center text-xs text-gray-700"
      onClick={() => changeTab('Today')}
    >
      <span
        aria-hidden
        className={`mr-1.5 inline-block size-2 rounded-full align-middle ${autopilot.dryRun ? 'bg-yellow-600' : 'bg-green-700'}`}
      />
      <span className="font-semibold">Autopilot:</span>{' '}
      {MODE_TEXT[autopilot.status.mode]}
      {autopilot.dryRun && ' · Dry run'} · {armed} armed
    </button>
  );
}
