import { ReactNode, use, useEffect, useId, useRef, useState } from 'react';

import { Booking, LLMP, isLLMP } from '@/api/itinerary';
import { Experience } from '@/api/ll';
import {
  MIN_TARGETED_IMPROVEMENT_MINUTES,
  findPartyLL,
} from '@/autopilot/automodify';
import {
  clearPendingSearch,
  loadPendingSearch,
  savePendingSearch,
} from '@/autopilot/nextll';
import {
  WatchTarget,
  inWindow,
  parseBound,
  saveWatchList,
} from '@/autopilot/watchlist';
import Button from '@/components/Button';
import Overlay from '@/components/Overlay';
import Tab from '@/components/Tab';
import { Time } from '@/components/Time';
import ContextStrip from '@/components/ll/ContextStrip';
import AutopilotContext from '@/contexts/AutopilotContext';
import BookingDateContext from '@/contexts/BookingDateContext';
import ExperiencesContext from '@/contexts/ExperiencesContext';
import NavContext from '@/contexts/NavContext';
import PlansContext from '@/contexts/PlansContext';
import TabsContext from '@/contexts/TabContext';
import { formatDate, parkDate } from '@/datetime';
import useSavedParty from '@/hooks/useSavedParty';
import AutopilotProvider from '@/providers/AutopilotProvider';
import { NEXTLL_WATCHLIST_KEY } from '@/storageNamespace';

import { HomeTabProps } from '../Home';
import { NextLLBookingActivity } from '../NextLLActivity';
import PartySelector from '../PartySelector';
import RefreshButton from '../RefreshButton';
import { NextLLModifyActions, NextLLModifyPicker } from './NextLLModify';
import ParkSelect from './ParkSelect';

export const NEXTLL = 'NextLL';

/**
 * Its own watch list, its own poller, inside AutoLL's tree.
 *
 * Nested rather than driving the Autopilot the tab bar already sits inside:
 * that one may be armed with a day's worth of attractions, and a quick search
 * must not add a sixth target to it, turn the whole thing on, or -- worse --
 * have Stop switch it all off. What it does inherit, by being nested, is the
 * park, the booking date, the plans, the tipboard and the login.
 */
/**
 * The window the search is aiming at, in words.
 *
 * Its own component, and it reads both bounds. The line used to render only
 * when `before` was set, so a search asked for a return *after* a time said
 * nothing about what it was aiming at -- on the one screen where a person
 * typed the bound themselves and is standing there waiting for it.
 */
function GoalLine({ target }: { target: WatchTarget }) {
  const { after, before } = target;
  if (after && before) {
    return (
      <GoalText>
        between <Time time={after} /> and <Time time={before} />
      </GoalText>
    );
  }
  if (after) {
    return (
      <GoalText>
        at or after <Time time={after} />
      </GoalText>
    );
  }
  if (before) {
    return (
      <GoalText>
        at or before <Time time={before} />
      </GoalText>
    );
  }
  return null;
}

/**
 * More than one person holds the chosen attraction, and the saved party does
 * not pick out whose reservation to move. Name the reservations and the one
 * thing that settles it, rather than quietly working on the earliest.
 */
function SeveralHeld({
  name,
  plans,
  experienceId,
  date,
}: {
  name?: string;
  plans: Booking[];
  experienceId: string;
  date: string;
}) {
  const { goTo } = use(NavContext);
  const reservations = plans.filter(
    (booking): booking is LLMP =>
      isLLMP(booking) &&
      booking.facilityId === experienceId &&
      parkDate(booking.start) === date &&
      booking.guests.length > 0
  );
  return (
    <div
      role="status"
      className="mt-3 rounded-2xl bg-amber-100 p-3.5 text-amber-900"
    >
      <p className="my-0 font-semibold">
        More than one person holds {name ?? 'this attraction'}.
      </p>
      <ul className="mt-1">
        {reservations.map(booking => (
          <li
            key={booking.id}
            className="mt-1 flex flex-wrap items-center justify-between gap-2"
          >
            <span>
              <Time time={booking.start.time} /> &mdash;{' '}
              {booking.guests.map(guest => guest.name).join(', ')}
            </span>
            {/* The reservation itself, picked here: a Time Search or a swap
                follows the one it was opened on. */}
            {booking.modifiable && (
              <Button
                type="small"
                onClick={() => goTo(<NextLLModifyActions booking={booking} />)}
              >
                Move this one
              </Button>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-2 mb-0 text-sm">
        Pick the one to move, or save a party of only the people whose
        reservation should move &mdash; the gear menu, then Party Selection
        &mdash; and start again.
      </p>
    </div>
  );
}

function GoalText({ children }: { children: ReactNode }) {
  return (
    <p className="mt-2 mb-0 text-sm font-semibold text-gray-600">
      Goal: a return time {children}.
    </p>
  );
}

export default function NextLLTab({ ref }: HomeTabProps) {
  return <NextLLChooser ref={ref} />;
}

/** The first decision keeps booking a new slot distinct from changing a hold. */
export function NextLLChooser({ ref }: Partial<HomeTabProps> = {}) {
  const [mode, setMode] = useState<'choose' | 'book' | 'modify'>('choose');
  if (mode === 'book') {
    return (
      <AutopilotProvider watchListKey={NEXTLL_WATCHLIST_KEY} rapid repeatMoves>
        <NextLL ref={ref} onBack={() => setMode('choose')} />
      </AutopilotProvider>
    );
  }
  if (mode === 'modify') {
    return <NextLLModifyPicker ref={ref} onBack={() => setMode('choose')} />;
  }
  return (
    <Tab title={NEXTLL} subhead={<ContextStrip />} ref={ref}>
      <h2 className="mt-3 font-display text-2xl font-bold tracking-tight">
        What do you want to do?
      </h2>
      <p className="mt-2 text-sm text-gray-600">
        Find a new Lightning Lane, or improve one you already hold.
      </p>
      <Button type="full" className="mt-4" onClick={() => setMode('book')}>
        Book a new Lightning Lane
      </Button>
      <p className="mt-1 text-sm text-gray-600">
        Takes the first acceptable return time, then keeps trying to improve it.
      </p>
      <Button type="full" className="mt-4" onClick={() => setMode('modify')}>
        Modify a held Lightning Lane
      </Button>
      <p className="mt-1 text-sm text-gray-600">
        Improve a held return time or search for a different attraction.
      </p>
    </Tab>
  );
}

/**
 * One attraction, one goal, one button.
 *
 * Autopilot's screen exposes every lever: six toggles per attraction, windows,
 * a budget, dry run, whole-party, clash avoidance. That is the right shape for
 * setting up a day in advance. It is the wrong shape at 7am with one hand and
 * a coffee, which is the moment this exists for -- "I want Slinky Dog, as
 * early as you can, go".
 *
 * Everything below is the Autopilot machinery underneath, driven through a
 * single target rather than a list. The strategy is `bookThenMove`, which is
 * exactly this problem already solved: while nothing is held the window is
 * stripped so any offered time is taken -- holding something beats holding
 * nothing -- and once something is held the window becomes the goal the move
 * step works toward.
 */
export function NextLL({
  ref,
  onBack,
}: Partial<HomeTabProps> & { onBack?: () => void } = {}) {
  // Applies the party saved in the LL tab. Only `useSavedParty` calls
  // `ll.setPartyIds`, and it is mounted by `MultiPassList` -- which is not
  // mounted while this tab is showing. Without this, an empty party id set
  // means nobody is marked NOT_IN_PARTY and a search books for everyone
  // eligible on the account, silently overriding the choice made next door.
  const [partyIds] = useSavedParty();
  const { experiences, refreshExperiences } = use(ExperiencesContext);
  const { goTo } = use(NavContext);
  const { plans } = use(PlansContext);
  const { bookingDate } = use(BookingDateContext);
  const {
    enabled,
    setEnabled,
    status,
    targets,
    replaceTargets,
    sessionLog,
    skipCounts,
    lastSkip,
    dryRun,
  } = use(AutopilotContext);
  // Leaving the tab ends the search, and a tap on a tab or on the footer row
  // used to do it with no word. While one runs, leaving asks first.
  const { setLeaveGuard } = use(TabsContext);
  const [leaving, setLeaving] = useState<() => void>();
  const leaveTitleId = useId();
  useEffect(() => {
    if (!enabled || !setLeaveGuard) return;
    setLeaveGuard((_to, leave) => {
      setLeaving(() => leave);
      return true;
    });
    return () => setLeaveGuard(undefined);
  }, [enabled, setLeaveGuard]);

  const [choice, setChoice] = useState('');
  const [after, setAfter] = useState('');
  const [before, setBefore] = useState('');
  // usePoller resets its public status when the search is turned off. Keep the
  // final count so Activity can still say how much work the completed search
  // did after Stop returns the form.
  const [lastPolls, setLastPolls] = useState(0);
  // What an interrupted search was after, read once on mount. Cleared as soon
  // as anything is started or dismissed, so it only ever describes a search
  // that is not running.
  // Matched on the booking date it was aimed at, not merely the day it was
  // written: prebooking means those two routinely differ.
  const [pending, setPending] = useState(() => loadPendingSearch(bookingDate));

  // Multi Pass only, same as Autopilot: matching reads `flex`, and there is no
  // Single Pass booking flow to offer.
  const bookable = experiences
    .filter((exp): exp is Experience => !!exp.flex)
    .sort((a, b) => a.name.localeCompare(b.name));

  const target = targets[0];
  const pendingExp =
    !enabled &&
    pending &&
    bookable.find(exp => exp.id === pending.experienceId);
  const chosen = bookable.find(
    exp => exp.id === (target?.experienceId ?? choice)
  );
  // By the engine's own rule, so the screen never names a different
  // reservation from the one the engine would move: the saved party's, and
  // `'several'` when that does not pick out one. See `findPartyLL`.
  const heldForParty =
    chosen && findPartyLL(plans, chosen.id, bookingDate, partyIds);
  const several = heldForParty === 'several';
  const held = several ? undefined : heldForParty;
  // The engine's own predicate, not a second one. Reading `before` alone said
  // "that will do" about a 9:40 return for a search asked to return after 3pm,
  // and offered Done beside it.
  const goalMet = !!held && (!target || inWindow(held.start.time, target));

  // `replaceTargets` rather than `addTarget`: this screen watches exactly one
  // attraction and names it, so a target from an earlier search must not
  // survive alongside the new one.
  function begin(experienceId: string, afterText: string, beforeText: string) {
    const lower = parseBound(afterText);
    const upper = parseBound(beforeText);
    const target: WatchTarget = {
      experienceId,
      // Book-then-move strips the window while nothing is held, so the first
      // offered time is booked and then walked earlier. That is coherent for
      // an upper bound and incoherent for a lower one: a move only ever goes
      // earlier, so a reservation booked below an "after" bound can never
      // climb into the window. Asked to return after 3pm, it booked 9:40 and
      // called the goal met. With a lower bound the window governs booking
      // instead, and moving improves within it.
      ...(lower
        ? { autoBook: true, autoModify: true }
        : { bookThenMove: true }),
      ...(lower ? { after: lower } : {}),
      ...(upper ? { before: upper } : {}),
      // Naming a time is the whole difference between this and an unattended
      // watch. The 30-minute bar exists to stop Autopilot churning a
      // reservation on its own; someone standing here asking for a slot has
      // already decided it is worth it, so any real gain counts. The bounds
      // above are what decide whether a time is wanted -- and `inWindow`
      // reads them in both directions, so a window around a *later* time is
      // admitted by the rules. What the search can actually reach is another
      // matter: the tipboard offers one time, the earliest, so a later slot
      // is only found if it happens to be that.
      ...(lower || upper
        ? { minImprovementMinutes: MIN_TARGETED_IMPROVEMENT_MINUTES }
        : {}),
    };
    replaceTargets([target]);
    setLastPolls(0);
    clearPendingSearch();
    setPending(undefined);
    setEnabled(true);
  }

  function start() {
    if (!choice) return;
    begin(choice, after, before);
  }

  function resume() {
    if (!pending) return;
    setChoice(pending.experienceId);
    // The stored bounds carry seconds; the time inputs do not want them.
    setAfter(pending.after?.slice(0, 5) ?? '');
    setBefore(pending.before?.slice(0, 5) ?? '');
    begin(pending.experienceId, pending.after ?? '', pending.before ?? '');
  }

  function dismissPending() {
    clearPendingSearch();
    setPending(undefined);
  }

  function stop() {
    // usePoller clears its counters when disabled; retain the completed total
    // without mirroring every rapid poll into a second render.
    setLastPolls(status.polls);
    setEnabled(false);
    replaceTargets([]);
    clearPendingSearch();
    setPending(undefined);
  }

  // Leaving the tab unmounts the provider, so the poller stops whatever this
  // does. What it must not do is leave the target behind: the provider
  // reloads the list on mount, and a leftover would be armed again while the
  // screen described only whatever was chosen next.
  //
  // Written straight to storage rather than through `replaceTargets`, because
  // an unmounting component's state update never reaches the effect that
  // persists it.
  const latest = useRef({ enabled, target, bookingDate });
  latest.current = { enabled, target, bookingDate };
  useEffect(
    () => () => {
      const { enabled, target } = latest.current;
      saveWatchList([], NEXTLL_WATCHLIST_KEY);
      if (enabled && target) {
        savePendingSearch({
          experienceId: target.experienceId,
          bookingDate: latest.current.bookingDate,
          ...(target.after ? { after: String(target.after) } : {}),
          ...(target.before ? { before: String(target.before) } : {}),
        });
      }
    },
    []
  );

  return (
    <Tab
      title={NEXTLL}
      buttons={
        <>
          <ParkSelect />
          <RefreshButton name="Experiences" onClick={refreshExperiences} />
        </>
      }
      subhead={<ContextStrip />}
      ref={ref}
    >
      {!enabled ? (
        <>
          {onBack && (
            <Button type="small" onClick={onBack}>
              Choose another action
            </Button>
          )}
          {pendingExp && (
            <div className="mt-3 rounded-2xl border border-gray-300 bg-white p-3.5">
              <p className="my-0">
                Still looking for{' '}
                <span className="font-semibold">{pendingExp.name}</span>?
                Searching stopped when you left this tab.
              </p>
              <div className="mt-3 flex gap-2">
                <Button onClick={resume}>Resume</Button>
                <Button onClick={dismissPending}>Start something else</Button>
              </div>
            </div>
          )}

          <p className={pendingExp ? 'mt-4' : undefined}>
            Pick one attraction and NextLL will take the first Lightning Lane it
            can get, then keep trying to move it earlier.
          </p>

          <label className="mt-4 block">
            <span className="font-semibold">Attraction</span>
            <select
              className="mt-1 block w-full rounded-xl border border-gray-300 bg-white p-2.5"
              value={choice}
              onChange={e => setChoice(e.target.value)}
            >
              <option value="">Choose one&hellip;</option>
              {bookable.map(exp => (
                <option key={exp.id} value={exp.id}>
                  {exp.name}
                </option>
              ))}
            </select>
          </label>

          <label className="mt-3 flex flex-wrap items-center gap-2">
            <span className="font-semibold">Return after</span>
            <input
              type="time"
              aria-label="Earliest acceptable return time"
              className="min-h-11 rounded-lg border border-gray-300 bg-white px-2 py-1"
              value={after}
              onChange={e => setAfter(e.target.value)}
            />
            <span className="text-sm text-gray-600">
              optional &mdash; nothing earlier is booked, even if nothing later
              comes
            </span>
          </label>

          <label className="mt-3 flex flex-wrap items-center gap-2">
            <span className="font-semibold">Return by</span>
            <input
              type="time"
              aria-label="Latest acceptable return time"
              className="min-h-11 rounded-lg border border-gray-300 bg-white px-2 py-1"
              value={before}
              onChange={e => setBefore(e.target.value)}
            />
            <span className="text-sm text-gray-600">
              optional &mdash; takes the first time offered, then moves it
              earlier to meet this
            </span>
          </label>

          {/* The same setting as Autopilot's, and the chip under the title was
              the only sign of it here. */}
          {dryRun && (
            <p className="mt-4 mb-0 rounded-2xl bg-yellow-100 p-3 text-sm font-semibold text-yellow-900">
              Dry run is on, so this books nothing either. It is the same
              setting as Autopilot&rsquo;s, in Configure.
            </p>
          )}
          <div className="mt-4">
            <Button type="full" onClick={start} disabled={!choice}>
              Find it
            </Button>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-gray-600">
            <span>
              {partyIds.size > 0
                ? `Books for your saved party of ${partyIds.size}.`
                : 'Books for everyone eligible.'}
            </span>
            <Button type="small" onClick={() => goTo(<PartySelector />)}>
              Choose party
            </Button>
          </div>
          {several && chosen && (
            <SeveralHeld
              name={chosen.name}
              plans={plans}
              experienceId={chosen.id}
              date={bookingDate}
            />
          )}

          {bookable.length === 0 && (
            <div className="mt-3 text-sm text-gray-600">
              <p className="my-0">
                No attractions loaded yet for this park. Refresh the list, or
                pick a different park above.
              </p>
              <div className="mt-2">
                <Button type="small" onClick={refreshExperiences}>
                  Refresh list
                </Button>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          <section
            aria-label="The search"
            className="mt-3 rounded-[20px] border border-gray-300 bg-white p-4"
          >
            <h2 className="mt-0 font-display text-2xl leading-tight font-bold tracking-tight">
              {chosen?.name}
            </h2>

            {held ? (
              // One sentence, so it still reads as one -- "Holding 2:05 PM --
              // still looking" -- with the time drawn as the line it deserves.
              <p className="mt-3 mb-0 text-sm font-semibold text-gray-600">
                Holding{' '}
                <Time
                  time={held.start.time}
                  className="my-1 block font-display text-5xl leading-none font-bold tracking-tight text-ink [&_span_span]:text-lg"
                />
                {goalMet ? (
                  <>
                    <span className="font-bold text-green-700">
                      {' '}
                      &mdash; that will do.
                    </span>
                    <span className="mt-1 block text-xs font-normal">
                      It keeps looking for an earlier time until you tap Done.
                    </span>
                  </>
                ) : (
                  <> &mdash; still looking for a time inside your window.</>
                )}
              </p>
            ) : several && chosen ? (
              <SeveralHeld
                name={chosen.name}
                plans={plans}
                experienceId={chosen.id}
                date={bookingDate}
              />
            ) : (
              <p className="mt-3 mb-0">
                Nothing held yet. Checking&hellip;{' '}
                <span className="text-gray-500">
                  ({status.polls} {status.polls === 1 ? 'check' : 'checks'})
                </span>
              </p>
            )}

            {/* The poller gives up after MAX_CONSECUTIVE_FAILURES and returns
              without scheduling another tick, leaving `enabled` true and the
              wake lock released. Every line above still reads as a live
              search, so without this the screen says "Checking..." at a loop
              that stopped -- and an expired session, which is what usually
              stops it, is exactly the case where the user has to do something.
              Autopilot's screen has said this since it had one. */}
            {status.mode === 'stopped' && (
              <p className="mt-3 mb-0 font-semibold text-red-700">
                Stopped after {status.consecutiveFailures} failed checks
                {status.lastError ? `: ${status.lastError}` : ''}. Tap{' '}
                {goalMet ? 'Done' : 'Stop looking'} and start it again to retry.
              </p>
            )}

            {target && <GoalLine target={target} />}

            {bookingDate !== parkDate() && (
              <p className="mt-1 mb-0 text-sm text-gray-600">
                Working on {formatDate(bookingDate, 'short')}, not today.
              </p>
            )}
          </section>

          {/* Done is the search succeeding, so it is green; Stop looking is
              giving up on it, so it stays red. Either way the same tap. */}
          <div className="mt-3">
            <Button
              type="full"
              color={
                goalMet ? 'bg-green-700 text-white' : 'bg-red-700 text-white'
              }
              onClick={stop}
            >
              {goalMet ? 'Done' : 'Stop looking'}
            </Button>
          </div>

          <p className="mt-3 text-sm text-gray-600">
            Keep this screen open and in front. Your phone will not sleep while
            it runs. Switching tabs stops the search &mdash; come back and it
            will offer to pick it up again.
          </p>
        </>
      )}

      <NextLLBookingActivity
        active={enabled}
        polls={Math.max(status.polls, lastPolls)}
        entries={sessionLog}
        skipCounts={skipCounts}
        lastSkip={lastSkip}
      />
      {leaving && (
        <Overlay>
          <div
            role="alertdialog"
            aria-labelledby={leaveTitleId}
            className="max-w-sm rounded-lg bg-white p-4 text-black"
          >
            <h3 id={leaveTitleId} className="mt-0 font-semibold">
              Leave NextLL?
            </h3>
            <p className="mt-2 mb-0">
              Leaving stops the search for {chosen?.name ?? 'this attraction'}.
              Today will offer to pick it up again.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button onClick={() => setLeaving(undefined)}>Stay</Button>
              <Button
                color="bg-red-700 text-white"
                border="border border-transparent"
                onClick={() => {
                  const leave = leaving;
                  setLeaving(undefined);
                  leave();
                }}
              >
                Leave
              </Button>
            </div>
          </div>
        </Overlay>
      )}
    </Tab>
  );
}
