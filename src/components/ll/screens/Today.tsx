import { use, useEffect, useMemo, useState, useSyncExternalStore } from 'react';

import { LLMP, isLLMP } from '@/api/itinerary';
import {
  audioStatus,
  soundCheck,
  subscribeAudioStatus,
} from '@/autopilot/alert';
import { checklist } from '@/autopilot/checklist';
import { describeMode } from '@/autopilot/describe';
import { latestActivity } from '@/autopilot/events';
import { loadPendingSearch } from '@/autopilot/nextll';
import { PlanReview, checkPlan, planReview } from '@/autopilot/plancheck';
import { NO_REFUSALS } from '@/autopilot/refusal';
import useQuarantine from '@/autopilot/useQuarantine';
import {
  screenAwakeStatus,
  subscribeScreenAwakeStatus,
} from '@/autopilot/wakelock';
import { WatchTarget, targetActs } from '@/autopilot/watchlist';
import Button from '@/components/Button';
import Tab from '@/components/Tab';
import { Time } from '@/components/Time';
import AutopilotStatus from '@/components/ll/AutopilotStatus';
import ContextStrip from '@/components/ll/ContextStrip';
import LatestEvent from '@/components/ll/LatestEvent';
import NotLoaded from '@/components/ll/NotLoaded';
import TargetWindow from '@/components/ll/TargetWindow';
import { clearSignInStop, signInStopAt } from '@/components/ll/signInStop';
import AutopilotContext from '@/contexts/AutopilotContext';
import BookingDateContext from '@/contexts/BookingDateContext';
import ClientsContext from '@/contexts/ClientsContext';
import ExperiencesContext from '@/contexts/ExperiencesContext';
import NavContext from '@/contexts/NavContext';
import ParkContext from '@/contexts/ParkContext';
import PlansContext from '@/contexts/PlansContext';
import PocketShieldContext from '@/contexts/PocketShieldContext';
import TabsContext from '@/contexts/TabContext';
import { DateTime, formatTime, parkDate, upcomingTimes } from '@/datetime';
import { PARTY_IDS_KEY } from '@/hooks/useSavedParty';
import {
  CheckCircleIcon,
  LinesIcon,
  LockIcon,
  PauseIcon,
  PulseIcon,
  SlidersIcon,
  SoundIcon,
  SunIcon,
} from '@/icons/LineIcons';
import kvdb from '@/kvdb';
import { loadSavedPartyIds } from '@/savedParty';
import { PLAN_CHECK_REVIEW_KEY } from '@/storageNamespace';

import Activity from './Activity';
import Configure from './Configure';
import { HomeTabProps } from './Home';
import BookingDateSelect from './Home/BookingDateSelect';
import ParkSelect from './Home/ParkSelect';
import PartySelector from './PartySelector';
import PlanCheck from './PlanCheck';
import RefreshButton from './RefreshButton';
import Timeline from './Timeline';

export const TODAY = 'Today';

/**
 * The park day at a glance, and the one switch that matters.
 *
 * Everything a person asks on a park day, in the order they ask it: is
 * Autopilot on, what did it just do, what is held, what is it after, when is
 * the next window. Setting the plan up is the Configure screen's job, and the
 * long lists are Activity's; this screen only ever reads what the providers
 * already hold, so opening it costs no request.
 *
 * The on/off switch lives here rather than in a header on purpose: enabling
 * is a deliberate step -- pick rides, grant notifications -- and a mis-tapped
 * header toggle that silently started or stopped polling would be worse than
 * one extra tap.
 */
export default function Today({ ref }: HomeTabProps) {
  const {
    enabled,
    setEnabled,
    status,
    targets,
    targetsHere,
    notifications,
    requestNotifications,
    lastHit,
    lastSkip,
    bookingLog,
    dryRun,
    requireWholeParty,
    avoidOverlaps,
    refusals,
    passkeyStatus,
  } = use(AutopilotContext);
  // Turning off takes a second tap while it runs: the button sits beside
  // Pocket it, the tap made most, and turning back on resets drop detection,
  // skip counts and the refusal state. Turning on stays one tap -- it is the
  // tap that arms the alert sound -- and a stopped run turns off in one.
  const [confirmingOff, setConfirmingOff] = useState(false);
  useEffect(() => {
    if (!confirmingOff) return;
    const timeoutId = self.setTimeout(() => setConfirmingOff(false), 3000);
    return () => clearTimeout(timeoutId);
  }, [confirmingOff]);
  function toggleAutopilot() {
    if (!enabled) return setEnabled(true);
    if (confirmingOff || status.mode === 'stopped') {
      setConfirmingOff(false);
      return setEnabled(false);
    }
    setConfirmingOff(true);
  }
  // Set when a Disney sign-in expired under a running engine; see signInStop.
  const [signInStop, setSignInStop] = useState(() => signInStopAt());
  useEffect(() => {
    if (!enabled || signInStop === undefined) return;
    clearSignInStop();
    setSignInStop(undefined);
  }, [enabled, signInStop]);
  const {
    experiences,
    refreshExperiences,
    unknownExperienceIds,
    lastUpdated: experiencesUpdated,
    loaderElem,
  } = use(ExperiencesContext);
  const {
    plans,
    refreshPlans,
    lastUpdated: plansUpdated,
    plansLoaded,
  } = use(PlansContext);
  const { park } = use(ParkContext);
  const { bookingDate } = use(BookingDateContext);
  const { ll } = use(ClientsContext);
  const { goTo } = use(NavContext);
  const { setShielded } = use(PocketShieldContext);
  const { changeTab } = use(TabsContext);
  const [reviewedPlan, setReviewedPlan] = useState<PlanReview | undefined>(() =>
    kvdb.get<PlanReview>(PLAN_CHECK_REVIEW_KEY)
  );
  const [now, setNow] = useState(() => Date.now());
  const doubts = useQuarantine();

  // The underlying data timestamps only change after successful requests. A
  // lightweight clock lets the wording remain truthful while this tab stays
  // open, without scheduling any additional network work.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const isToday = bookingDate === parkDate();
  const activity = latestActivity({ bookingLog, lastSkip, lastHit });
  // Every Multi Pass held on the date, wherever it is: the party holds at
  // most three at a time and on a hopping day they span parks, so hiding one
  // would hide a slot that is spent.
  const held = plans.filter(
    (booking): booking is LLMP =>
      isLLMP(booking) && parkDate(booking.start) === bookingDate
  );
  const nextDrop = isToday
    ? upcomingTimes(park.dropTimes)[0]
    : park.dropTimes[0];
  const nameOf = (target: WatchTarget) =>
    experiences.find(e => e.id === target.experienceId)?.name ??
    target.name ??
    target.experienceId;
  const plan = [...targetsHere].sort(
    (a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity)
  );
  const soundStatus = useSyncExternalStore(
    subscribeAudioStatus,
    audioStatus,
    audioStatus
  );
  const awakeStatus = useSyncExternalStore(
    subscribeScreenAwakeStatus,
    screenAwakeStatus,
    screenAwakeStatus
  );
  const checkSound = () => void soundCheck();
  // Armed means it will act: a paused target keeps its arming but is counted
  // with the paused, not with the armed.
  const armed = targetsHere.filter(t => targetActs(t) && !t.paused).length;
  const paused = targetsHere.filter(t => t.paused).length;
  // A NextLL search stops when its tab is left; the tab offers to resume it,
  // but only once you are back there. This is the reminder to go back. Matched
  // on the day it was aimed at, so a search for another park day is not
  // advertised against this one.
  const pending = loadPendingSearch(bookingDate);
  const pendingName = pending
    ? (experiences.find(e => e.id === pending.experienceId)?.name ??
      pending.experienceId)
    : undefined;
  const unknown = unknownExperienceIds?.length ?? 0;
  // Read each render and compared as text, so a changed party reaches the memo.
  const partyKey = JSON.stringify(loadSavedPartyIds());
  const planCheckInput = useMemo(
    () => ({
      targets,
      parkId: park.id,
      date: bookingDate,
      experiences,
      plans,
      partyIds: JSON.parse(partyKey) as string[],
      requireWholeParty,
      avoidOverlaps,
      dryRun,
      tierLimitLifted: passkeyStatus === 'unlocked',
    }),
    [
      targets,
      park.id,
      bookingDate,
      experiences,
      plans,
      partyKey,
      requireWholeParty,
      avoidOverlaps,
      dryRun,
      passkeyStatus,
    ]
  );
  const currentReview = useMemo(() => {
    const items = checkPlan(planCheckInput);
    return planReview(planCheckInput, items);
  }, [planCheckInput]);
  const readiness = checklist({
    // Read-only: mounting useSavedParty here would call ll.setPartyIds while
    // this screen is merely being viewed.
    partySize: kvdb.get<string[]>(PARTY_IDS_KEY)?.length ?? 0,
    targets: targetsHere,
    notifications,
    planReviewed: reviewedPlan?.key === currentReview.key,
    planBlockers: currentReview.blockers,
  });

  const rememberReview = (review: PlanReview) => {
    setReviewedPlan(review);
    try {
      kvdb.set(PLAN_CHECK_REVIEW_KEY, review);
    } catch (error) {
      // The acknowledgement still lasts for this mounted screen when durable
      // storage is unavailable; it simply will not survive a reload.
      console.error(error);
    }
  };
  const openPlanCheck = () => goTo(<PlanCheck onReviewed={rememberReview} />);
  // This line describes both data sets, so it reports the older of the two
  // fetches -- and only once *both* have fetched. Filtering the undefined ones
  // out first and taking the minimum of what was left meant one loaded context
  // beside one that had never fetched read as though both were current, which
  // over-claims in exactly the state where trusting this line is wrong: it is
  // the line that tells you whether to believe the rest of the screen.
  const updatedAt = [experiencesUpdated, plansUpdated];
  const lastUpdated = updatedAt.every(updated => updated !== undefined)
    ? Math.min(...updatedAt)
    : undefined;
  const freshness =
    lastUpdated === undefined
      ? undefined
      : Math.max(0, Math.floor((now - lastUpdated) / 60_000));

  return (
    <Tab
      title={TODAY}
      buttons={
        <>
          {ll.rules.prebook && <BookingDateSelect />}
          <ParkSelect />
          <RefreshButton
            name="Plans and experiences"
            onClick={() => {
              refreshExperiences();
              refreshPlans();
            }}
          />
        </>
      }
      subhead={<ContextStrip />}
      ref={ref}
    >
      {freshness !== undefined && (
        <p className="mt-3 mb-0 text-xs text-gray-600">
          Plans and LL availability are current as of{' '}
          {freshness === 0 ? 'just now' : `${freshness} min ago`}.
        </p>
      )}

      {/* Glance: is it running, when is the next drop, can it be heard, is the
          screen held, and what did it last do. */}
      <section
        aria-label="Autopilot status"
        className="mt-3 rounded-[20px] border border-gray-300 bg-white p-4"
      >
        <AutopilotStatus status={status} refusals={refusals ?? NO_REFUSALS} />
        {/* On iOS Safari the chime is not one channel of three, it is the only
            one: `Notification` is undefined outside an installed web app and
            vibration is unimplemented. A context that never unlocked, or that
            iOS interrupted, is silent and announces nothing -- so the state is
            shown, and there is a way to hear it on purpose rather than by
            waiting for a real find and wondering. */}
        {(soundStatus !== 'unsupported' ||
          (enabled && awakeStatus !== 'unsupported')) && (
          <div className="mt-3 flex flex-col gap-2 border-t border-gray-200 pt-3">
            {soundStatus !== 'unsupported' && (
              <div className="flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2">
                  <SoundIcon className="size-4 text-gray-500" />
                  <span
                    className={`text-sm ${
                      soundStatus === 'armed' || !enabled
                        ? 'text-gray-600'
                        : 'font-semibold text-red-700'
                    }`}
                  >
                    {soundStatus === 'armed'
                      ? 'Alert sound is armed.'
                      : enabled
                        ? 'Alert sound is not armed, so alerts would be silent.'
                        : 'Test alert sound before starting Autopilot.'}
                  </span>
                </span>
                <Button
                  type="small"
                  className="shrink-0 whitespace-nowrap"
                  onClick={checkSound}
                >
                  Test sound
                </Button>
              </div>
            )}
            {enabled && awakeStatus !== 'unsupported' && (
              <div className="flex items-center gap-2">
                <SunIcon className="size-4 text-gray-500" />
                <p
                  className={`my-0 text-sm ${
                    awakeStatus === 'held'
                      ? 'text-gray-600'
                      : 'font-semibold text-red-700'
                  }`}
                >
                  {awakeStatus === 'held'
                    ? 'Screen is being kept awake.'
                    : 'Screen may sleep, which can slow or pause checks. On an iPhone, Low Power Mode is the usual cause.'}
                </p>
              </div>
            )}
          </div>
        )}
        <LatestEvent event={activity} />
      </section>

      {signInStop !== undefined && !enabled && (
        <div
          role="status"
          className="mt-3 rounded-2xl bg-red-100 p-3.5 text-sm text-red-900"
        >
          <p className="my-0 font-semibold">
            Autopilot stopped at {formatTime(DateTime.from(signInStop).time)}{' '}
            when your Disney sign-in expired.
          </p>
          {/* Never switched back on for you: turning it on is the tap that
              arms the alert sound. */}
          <p className="mt-1 mb-0">
            It is off now, and nothing ran while you were signed out. Turn it on
            again when you are ready.
          </p>
          <div className="mt-2">
            <Button
              type="small"
              onClick={() => {
                clearSignInStop();
                setSignInStop(undefined);
              }}
            >
              Dismiss
            </Button>
          </div>
        </div>
      )}

      {/* Act. The switch stays up here, in the page, rather than in a bar
          along the bottom as the mockups drew it: a bar there sits directly
          above the tabs, where a thumb reaching for a tab would find Stop.
          Pocket it comes first because, once running, it is the tap you make
          most. It is offered only while the engine runs, because that is the
          only time the wake lock holds the screen on and the glass stays live
          in a pocket. */}
      <div className="mt-3 flex gap-2">
        {enabled && (
          <Button
            type="full"
            className="flex-1"
            color="bg-ink text-white"
            onClick={() => setShielded(true)}
          >
            <LockIcon className="mr-2 size-4.5" />
            Pocket it
          </Button>
        )}
        <Button
          type="full"
          className={enabled ? 'w-auto! shrink-0' : ''}
          onClick={toggleAutopilot}
          color={
            !enabled
              ? 'bg-green-700 text-white'
              : confirmingOff
                ? 'bg-red-700 text-white'
                : 'bg-white text-red-700'
          }
          border={enabled ? 'border border-red-300' : undefined}
        >
          {!enabled
            ? 'Turn on autopilot'
            : confirmingOff
              ? 'Tap again to turn off'
              : 'Turn off autopilot'}
        </Button>
      </div>

      <div className="mt-3 grid grid-cols-4 gap-2">
        <Button
          className="h-18 flex-col gap-1.5 px-1! text-xs"
          onClick={() => goTo(<Configure />)}
        >
          <SlidersIcon />
          Configure
        </Button>
        <Button
          className="h-18 flex-col gap-1.5 px-1! text-xs"
          onClick={openPlanCheck}
        >
          <CheckCircleIcon />
          Plan check
        </Button>
        <Button
          className="h-18 flex-col gap-1.5 px-1! text-xs"
          onClick={() => goTo(<Timeline />)}
        >
          <LinesIcon />
          Timeline
        </Button>
        <Button
          className="h-18 flex-col gap-1.5 px-1! text-xs"
          onClick={() => goTo(<Activity />)}
        >
          <PulseIcon />
          Activity
        </Button>
      </div>

      {doubts.length > 0 && (
        <section
          className="mt-3 rounded-2xl bg-red-100 p-3.5 text-sm text-red-900"
          role="alert"
        >
          <p className="my-0 font-semibold">
            {doubts.length} unresolved Lightning Lane change
            {doubts.length === 1 ? ' needs' : 's need'} review.
          </p>
          <p className="mt-1 mb-0">
            Autopilot has stopped automatically booking, moving, or swapping the
            affected attractions until Disney Plans confirms what happened or
            you resolve the protection.
          </p>
          <Button
            type="small"
            className="mt-2"
            onClick={() => goTo(<Activity />)}
          >
            Review protection
          </Button>
        </section>
      )}

      {!isToday && (
        <section
          className="mt-3 rounded-2xl border border-gray-300 bg-white p-4"
          aria-label="Pre-trip checklist"
        >
          <h3 className="mt-0 font-bold">Before your trip</h3>
          <ul className="mt-2 divide-y divide-gray-200 text-sm">
            {readiness.map(item => (
              <li
                key={item.subject}
                className="flex min-h-11 items-center justify-between gap-2 py-1.5"
              >
                <span className={item.done ? '' : 'font-semibold'}>
                  {item.done ? '✓' : '○'} {item.text}
                </span>
                {(!item.done || item.subject === 'plan-check') && (
                  <Button
                    type="small"
                    onClick={() => {
                      if (item.subject === 'party') goTo(<PartySelector />);
                      else if (
                        item.subject === 'targets' ||
                        item.subject === 'settings'
                      ) {
                        goTo(<Configure />);
                      } else if (item.subject === 'plan-check') {
                        openPlanCheck();
                      } else requestNotifications();
                    }}
                  >
                    {item.subject === 'notifications'
                      ? 'Enable'
                      : item.done
                        ? 'Review'
                        : 'Open'}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {dryRun && (
        <div className="mt-3 rounded-2xl bg-yellow-100 p-3.5 text-sm font-semibold text-yellow-900">
          <p className="my-0">
            Dry run is on. Autopilot will watch, alert, and run every check, and
            the activity log will show what it <em>would</em> have booked,
            moved, or swapped &mdash; but nothing will actually be booked. Turn
            it off in Configure when you are ready for it to act.
          </p>
          {/* Configure, not a switch here: turning a safeguard off stays on
              the screen that explains it. */}
          <div className="mt-2">
            <Button type="small" onClick={() => goTo(<Configure />)}>
              Open Configure
            </Button>
          </div>
        </div>
      )}
      {notifications === 'denied' && (
        <p className="mt-3 mb-0 text-sm font-semibold text-red-700">
          Notifications are blocked, so alerts will only chime. Enable them for
          this site in your browser settings.
        </p>
      )}
      {/* iPhone Safari lands here. It does not vibrate for a web page either,
          and running from the Home Screen is ruled out, so the sound is the
          whole alarm -- which is what this has to say. */}
      {notifications === 'unsupported' && (
        <p className="mt-3 mb-0 text-sm text-gray-600">
          This browser shows no notifications, so the alert sound is the only
          alarm. Keep it armed with Test sound.
        </p>
      )}
      {unknown > 0 && (
        <div className="mt-3 text-sm font-semibold text-red-700">
          <p className="my-0">
            Disney is listing {unknown} attraction{unknown === 1 ? '' : 's'}{' '}
            this build does not recognise. Configure names{' '}
            {unknown === 1 ? 'it' : 'them'}.
          </p>
          <div className="mt-2">
            <Button type="small" onClick={() => goTo(<Configure />)}>
              Open Configure
            </Button>
          </div>
        </div>
      )}
      {pending && (
        <div className="mt-3 rounded-2xl border border-gray-300 bg-white p-3.5 text-sm">
          <p className="my-0">
            Still looking for <b>{pendingName}</b>? That search stopped when you
            left the NextLL tab.
          </p>
          <Button
            type="small"
            className="mt-2"
            onClick={() => changeTab('NextLL')}
          >
            Open NextLL
          </Button>
        </div>
      )}

      {(ll.nextBookTime || nextDrop) && (
        <div className="mt-4 flex gap-2">
          {ll.nextBookTime && (
            <p className="my-0 flex-1 rounded-2xl border border-gray-300 bg-white px-3.5 py-2.5">
              <span className="block text-xs font-bold tracking-wide text-gray-600 uppercase">
                Next Lightning Lane:
              </span>{' '}
              <Time
                time={ll.nextBookTime}
                className="font-display text-2xl leading-tight font-bold [&_span_span]:text-sm"
              />
            </p>
          )}
          {nextDrop && (
            <p className="my-0 flex-1 rounded-2xl border border-gray-300 bg-white px-3.5 py-2.5">
              <span className="block text-xs font-bold tracking-wide text-gray-600 uppercase">
                Next drop:
              </span>{' '}
              <Time
                time={nextDrop}
                className="font-display text-2xl leading-tight font-bold [&_span_span]:text-sm"
              />
            </p>
          )}
        </div>
      )}

      <section aria-label="Held">
        <h3 className="mt-5 mb-2 font-bold">
          {plansLoaded || held.length > 0 ? `Held (${held.length})` : 'Held'}
        </h3>
        {held.length === 0 && !plansLoaded ? (
          <NotLoaded what="Plans" onRefresh={refreshPlans} />
        ) : held.length === 0 ? (
          <p className="my-0 text-sm text-gray-600">
            No Multi Pass reservations {isToday ? 'yet today' : 'on this date'}.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {held.map(lane => (
              <li
                key={lane.id}
                className="flex overflow-hidden rounded-2xl border border-gray-300 bg-white"
              >
                {/* A ticket: the ride on the left, its return time on the
                    stub. The em dash stays in the text for a screen reader,
                    where the stub's edge is not there to separate them. */}
                <span className="flex min-w-0 flex-1 flex-col justify-center px-3.5 py-3">
                  <span className="text-base leading-snug font-bold">
                    {lane.name}
                  </span>
                  {lane.guests.length > 0 && (
                    <span className="mt-0.5 text-[13px] text-gray-600">
                      {lane.guests.map(guest => guest.name).join(', ')}
                    </span>
                  )}
                </span>
                {/* A pass carried over from an earlier park day comes back with
                    a date and no time; dereferencing `.time` there would throw
                    and take the provider above down with the screen. */}
                {lane.start?.time && lane.end?.time ? (
                  <span className="flex min-w-27 flex-col items-end justify-center border-l border-dashed border-gray-400 px-3.5 py-2.5">
                    <span className="sr-only"> &mdash; </span>
                    <Time
                      time={lane.start.time}
                      className="font-display text-2xl leading-tight font-bold [&_span_span]:text-sm"
                    />
                    <span className="text-xs text-gray-600">
                      {' '}
                      to <Time time={lane.end.time} />
                    </span>
                  </span>
                ) : (
                  <span className="flex items-center border-l border-dashed border-gray-400 px-3.5 text-sm text-gray-600">
                    {' '}
                    &mdash; no return time
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Plan">
        <h3 className="mt-5 mb-0 font-bold">Plan ({targetsHere.length})</h3>
        {targetsHere.length === 0 ? (
          <p className="mt-2 mb-0 text-sm text-gray-600">
            Nothing watched at {park.name} on this date. Configure is where a
            plan starts.
          </p>
        ) : (
          <>
            <p className="mt-0.5 mb-2 text-xs text-gray-600">
              {armed} armed
              {paused > 0 ? `, ${paused} paused` : ''}
            </p>
            <ul className="divide-y divide-gray-200 overflow-hidden rounded-2xl border border-gray-300 bg-white">
              {plan.map(target => (
                <li
                  key={target.experienceId}
                  className="flex items-center gap-3 px-3.5 py-3"
                >
                  {/* The rank as a badge, or a pause mark. The words stay
                      below for anything reading the text rather than the
                      badge. */}
                  <span
                    aria-hidden
                    className={`flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-extrabold ${
                      target.paused
                        ? 'bg-gray-100 text-gray-500'
                        : 'bg-accent/12 text-accent'
                    }`}
                  >
                    {target.paused ? (
                      <PauseIcon className="size-3.5" />
                    ) : typeof target.rank === 'number' ? (
                      target.rank
                    ) : (
                      '·'
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block text-[15px] font-bold ${target.paused ? 'text-gray-600' : ''}`}
                    >
                      {nameOf(target)}
                    </span>
                    <span className="block text-[13px] text-gray-600">
                      <span className="sr-only"> · </span>
                      {target.paused ? 'Paused · ' : ''}
                      {describeMode(target)}
                      {(target.after || target.before) && (
                        <>
                          {' '}
                          ·{' '}
                          <TargetWindow
                            after={target.after}
                            before={target.before}
                          />
                        </>
                      )}
                      {typeof target.rank === 'number' && (
                        <span className="sr-only"> · Rank {target.rank}</span>
                      )}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
      {passkeyStatus !== 'off' && (
        <p className="mt-3 mb-0 text-sm">
          <span className="font-semibold">Passkey:</span>{' '}
          {passkeyStatus === 'unlocked'
            ? 'Disney confirmed the Tier 1 hold is unlocked for the selected party.'
            : 'Waiting for Disney to confirm every selected guest cleared the Tier 1 hold.'}
        </p>
      )}
      {loaderElem}
    </Tab>
  );
}
