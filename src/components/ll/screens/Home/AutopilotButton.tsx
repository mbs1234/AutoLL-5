import { use } from 'react';

import { modeText } from '@/autopilot/status';
import { targetActs } from '@/autopilot/watchlist';
import Button from '@/components/Button';
import { AUTOPILOT } from '@/components/ll/AutopilotStatus';
import AutopilotContext from '@/contexts/AutopilotContext';
import TabsContext from '@/contexts/TabContext';

/**
 * Shows at a glance whether Autopilot is running, and opens the Today tab,
 * where the switch is.
 *
 * Deliberately not a toggle. Enabling autopilot is a setup step -- choose
 * attractions, grant notification permission -- and a mis-tap here silently
 * starting or stopping background polling would be worse than one extra tap.
 *
 * A dot and the armed count, the same count the footer row and Pocket mode
 * show. It used to be the clock icon, which is also the Times tab, and it
 * showed no count at zero -- the one count that means it can only alert.
 */
export default function AutopilotButton() {
  const { changeTab } = use(TabsContext);
  const { enabled, status, targetsHere, dryRun } = use(AutopilotContext);
  const running = enabled && status.mode !== 'stopped';
  const attention = enabled && status.mode === 'stopped';
  // Still on and still armed, but sitting out a wait Disney asked for.
  const waiting = enabled && status.mode === 'waiting';
  const armed = targetsHere.filter(t => targetActs(t) && !t.paused).length;

  return (
    <Button
      title={
        waiting
          ? `${AUTOPILOT} waiting: Disney asked to slow down`
          : running
            ? `${AUTOPILOT} on${dryRun ? ' (dry run)' : ''}, ${armed} armed`
            : attention
              ? `${AUTOPILOT} ${lowerFirst(modeText(status))}`
              : `${AUTOPILOT} off`
      }
      onClick={() => changeTab('Today')}
      // Yellow while rehearsing, so a forgotten dry run is visible from the
      // header rather than discovered when nothing gets booked.
      color={
        attention
          ? 'bg-red-700 text-white'
          : waiting || (running && armed === 0)
            ? 'bg-amber-600 text-white'
            : running && dryRun
              ? 'bg-yellow-600 text-white'
              : running
                ? 'bg-green-700 text-white'
                : undefined
      }
    >
      <span
        aria-hidden
        className={`inline-block size-2.5 rounded-full ${running || attention ? 'bg-white' : 'border-2 border-gray-400'}`}
      />
      {running && <span className="ml-1.5 text-sm font-bold">{armed}</span>}
    </Button>
  );
}

/** "Stopped: ..." reads as "Autopilot stopped: ..." after the name. */
function lowerFirst(text: string) {
  return text.charAt(0).toLowerCase() + text.slice(1);
}
