import { use, useCallback, useRef } from 'react';

import NavContext from '@/contexts/NavContext';
import TabsContext, { LeaveGuard, TabDef } from '@/contexts/TabContext';

export default function withTabs<N extends string>(
  { tabs, footer }: { tabs: TabDef<N>[]; footer: React.ReactNode },
  Component: React.FC<{ tab: TabDef<N> }>
) {
  return function Tabbed({ tabName }: { tabName: N }) {
    const { goTo } = use(NavContext);
    // A running NextLL search stops when its tab is left, and a thumb aimed
    // at a tab, or at the footer row, left it with no word. A screen with work
    // to lose sets a guard, and the change waits on the person's answer.
    const leaveGuard = useRef<LeaveGuard>(undefined);
    const setLeaveGuard = useCallback((guard: LeaveGuard | undefined) => {
      leaveGuard.current = guard;
    }, []);
    const changeTab = useCallback(
      (name: N) => {
        if (name === tabName) return;
        const leave = () => goTo(<Tabbed tabName={name} />, { replace: true });
        if (leaveGuard.current?.(name, leave)) return;
        leave();
      },
      [tabName, goTo]
    );
    const scrollPos = useRef(Object.fromEntries(tabs.map(t => [t.name, 0])));
    const active = tabs.find(({ name }) => name === tabName) ?? tabs[0];

    if (!active) return null;

    return (
      <TabsContext
        value={{
          tabs,
          active,
          changeTab: changeTab as (tab: string) => void,
          setLeaveGuard,
          scrollPos: {
            get: () => {
              return scrollPos.current[active.name] ?? 0;
            },
            set: pos => {
              scrollPos.current[active.name] = pos;
            },
          },
          footer,
        }}
      >
        <Component tab={active} />
      </TabsContext>
    );
  };
}
