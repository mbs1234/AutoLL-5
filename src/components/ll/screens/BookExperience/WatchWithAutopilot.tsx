import { use } from 'react';

import Button from '@/components/Button';
import AutopilotContext from '@/contexts/AutopilotContext';
import NavContext from '@/contexts/NavContext';

import Configure from '../Configure';

/**
 * Hands a ride to Autopilot from the booking screen: one with no slots for the
 * party, or an offer at a time that does not suit. It goes on Autopilot's list
 * for this park and day alert-only, as Configure adds one, and its card opens
 * there, where what Autopilot should do about it is chosen. Nothing is armed
 * from here: booking stays a choice made in Configure.
 */
export default function WatchWithAutopilot({
  experienceId,
  soldOut,
}: {
  experienceId: string;
  /** No slots for the party, rather than an offer on screen. */
  soldOut: boolean;
}) {
  const { goTo } = use(NavContext);
  const { isWatched, addTarget } = use(AutopilotContext);
  const listed = isWatched(experienceId);
  let text: string;
  if (listed) {
    text = "It is on Autopilot's list for this park and day.";
  } else if (soldOut) {
    text =
      'Autopilot can watch for it while it runs, and alert you when it comes back.';
  } else {
    text = 'Not the time you want? Autopilot can watch it while it runs.';
  }
  return (
    <div className="mt-4">
      <p className="mt-0 mb-2 text-sm">{text}</p>
      <Button
        type="small"
        onClick={() => {
          if (!listed) addTarget({ experienceId });
          goTo(
            <Configure
              focus={{ kind: 'target', experienceId, added: !listed }}
            />
          );
        }}
      >
        {listed ? 'Open in Configure' : 'Watch with Autopilot'}
      </Button>
    </div>
  );
}
