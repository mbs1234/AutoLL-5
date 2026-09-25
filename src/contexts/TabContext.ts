import { createContext } from 'react';

export interface TabDef<Name extends string> {
  name: Name;
  icon: React.ReactNode;
  component: React.FC<any>;
}

/**
 * Asked before the tab changes. Returning true holds the change: the guard
 * has asked the person, and calls `leave` if they choose to go.
 */
export type LeaveGuard = (to: string, leave: () => void) => boolean;

interface Context<N extends string> {
  tabs: TabDef<N>[];
  active: TabDef<N>;
  changeTab: (tab: N) => void;
  /** A screen that loses work when left sets this while it has some. */
  setLeaveGuard?: (guard: LeaveGuard | undefined) => void;
  scrollPos: {
    get: () => number;
    set: (pos: number) => void;
  };
  footer?: React.ReactNode;
}

export default createContext<Context<string>>({
  tabs: [],
  active: {
    name: '',
    icon: null,
    component: () => null,
  },
  changeTab: () => {},
  scrollPos: { get: () => 0, set: () => {} },
});
