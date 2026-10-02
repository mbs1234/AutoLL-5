import { useCallback, useEffect, useState } from 'react';

import Button from '@/components/Button';
import PocketShield from '@/components/ll/PocketShield';
import { onIPhone } from '@/components/ll/onIPhone';
import { createPocketSearchStore } from '@/components/ll/pocketSearch';
import PocketShieldContext from '@/contexts/PocketShieldContext';

/** How long the reminder to end Guided Access stays, unless dismissed. */
export const END_GUIDED_ACCESS_MS = 15_000;

/**
 * Owns whether the screen is guarded, and renders the guard.
 *
 * A provider rather than two lines in `Merlock`, because `Merlock`'s tree is
 * mirrored by hand in `harness/HarnessApp.tsx` and the first version of this
 * feature was added to only one of them -- so the harness exercised an app
 * without it and could not have caught a wiring mistake. Anything both trees
 * need belongs in one component that both mount.
 *
 * It must sit inside the autopilot providers, so the shield can report what the
 * engine is doing, and outside `NavProvider`'s stack, because that keeps pushed
 * screens mounted and merely hides them -- a shield rendered inside a screen
 * would be hidden along with it.
 */
export default function PocketShieldProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [shielded, setShielded] = useState(false);
  // Learned from a deliberate moving-target sequence and deliberately kept in
  // memory only. A wide thumb should not pay the escape cost every time the
  // phone is re-pocketed, while a reload starts from the strict defaults.
  const [wideTouchLearned, setWideTouchLearned] = useState(false);
  // A web page cannot tell whether Guided Access is on, and an iPhone left in
  // it all day has no emergency calls and no Crash Detection. Lifting the
  // shield is the moment to say so: once, briefly, and only on an iPhone.
  const [endGuidedAccess, setEndGuidedAccess] = useState(false);
  useEffect(() => {
    if (!endGuidedAccess) return;
    const timer = setTimeout(
      () => setEndGuidedAccess(false),
      END_GUIDED_ACCESS_MS
    );
    return () => clearTimeout(timer);
  }, [endGuidedAccess]);
  const shield = useCallback((on: boolean) => {
    setShielded(on);
    if (on) setEndGuidedAccess(false);
  }, []);
  // What a NextLL search reports about itself. The shield reads it while it
  // is set; otherwise it describes the day plan's Autopilot.
  const [search] = useState(createPocketSearchStore);
  return (
    <PocketShieldContext
      value={{ shielded, setShielded: shield, showInPocket: search.set }}
    >
      <div
        className="contents"
        inert={shielded}
        aria-hidden={shielded || undefined}
        data-testid="pocket-content"
      >
        {children}
      </div>
      {shielded && (
        <PocketShield
          onExit={() => {
            setShielded(false);
            if (onIPhone()) setEndGuidedAccess(true);
          }}
          wideTouchLearned={wideTouchLearned}
          onLearnWideTouch={() => setWideTouchLearned(true)}
          search={search}
        />
      )}
      {endGuidedAccess && !shielded && (
        <div
          role="status"
          className="fixed inset-x-3 top-3 z-40 rounded-2xl border border-gray-300 bg-white p-3.5 text-sm text-black shadow-lg"
        >
          <p className="my-0">
            Pocket mode is off. If Guided Access is on, triple-click the side
            button to end it: emergency calls and Crash Detection do not work
            during it.
          </p>
          <div className="mt-2">
            <Button type="small" onClick={() => setEndGuidedAccess(false)}>
              Dismiss
            </Button>
          </div>
        </div>
      )}
    </PocketShieldContext>
  );
}
