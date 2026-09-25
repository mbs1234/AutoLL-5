import { use } from 'react';

import Button from '@/components/Button';
import { Time } from '@/components/Time';
import RebookingContext from '@/contexts/RebookingContext';
import TabsContext from '@/contexts/TabContext';

/**
 * Modify mode, said on every tab while it lasts.
 *
 * Tapping Modify on a held pass leaves the app changing that pass until Keep
 * or a booking ends it, and only the LL tab and the booking screens said so.
 * Hours later, a "new" booking from the LL tab replaced the held pass. The LL
 * tab has its own header for this, so the strip stays off it.
 */
export default function RebookingStrip() {
  const rebooking = use(RebookingContext);
  const { active } = use(TabsContext);
  const current = rebooking.current;
  if (!current || rebooking.auto || active.name === 'LL') return null;
  return (
    <div
      role="status"
      className="flex items-center gap-2 border-t border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-900"
    >
      <span className="min-w-0 flex-1">
        <span className="font-semibold">Modifying</span> {current.name}
        {current.start?.time && (
          <>
            {' '}
            &middot; <Time time={current.start.time} />
          </>
        )}
      </span>
      <Button type="small" onClick={rebooking.end}>
        Keep current
      </Button>
    </div>
  );
}
