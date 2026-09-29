import { use } from 'react';

import { modeText } from '@/autopilot/status';
import { targetActs } from '@/autopilot/watchlist';
import TabsContext from '@/contexts/TabContext';
import TopAutopilotContext from '@/contexts/TopAutopilotContext';

/**
 * A compact, tappable day-plan summary for tabs other than Today.
 *
 * The actual on/off control remains on Today. This is deliberately navigation
 * only: a footer mis-tap should never change booking behaviour.
 *
 * The dot says how it is going, and the words say it too: red once it has
 * stopped (it stayed green, so a dead run looked like a live one from every
 * tab but Today), amber while it waits because Disney asked it to slow down,
 * yellow in a dry run. Nothing armed is amber as well, since then it can only
 * alert.
 */
export default function AutopilotStatusRow() {
  const autopilot = use(TopAutopilotContext);
  const { active, changeTab } = use(TabsContext);

  if (!autopilot?.enabled || active.name === 'Today') return null;

  const armed = autopilot.targetsHere.filter(
    target => targetActs(target) && !target.paused
  ).length;
  const stopped = autopilot.status.mode === 'stopped';
  const waiting = autopilot.status.mode === 'waiting';
  const dot = stopped
    ? 'bg-red-700'
    : waiting
      ? 'bg-amber-600'
      : autopilot.dryRun
        ? 'bg-yellow-600'
        : 'bg-green-700';
  return (
    <button
      className={`w-full border-t border-gray-200 bg-gray-50 px-3 py-1.5 text-center text-xs ${stopped ? 'font-semibold text-red-700' : 'text-gray-700'}`}
      onClick={() => changeTab('Today')}
    >
      <span
        aria-hidden
        className={`mr-1.5 inline-block size-2 rounded-full align-middle ${dot}`}
      />
      <span className="font-semibold">Autopilot:</span>{' '}
      {modeText(autopilot.status)}
      {autopilot.dryRun && ' · Dry run'} ·{' '}
      <span className={armed === 0 ? 'font-semibold text-amber-800' : ''}>
        {armed} armed
      </span>
    </button>
  );
}
