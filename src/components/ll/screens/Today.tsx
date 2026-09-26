import { use, useEffect, useMemo, useState, useSyncExternalStore } from 'react';

import { authStore } from '@/api/auth';
import { LLMP, isLLMP } from '@/api/itinerary';
import {
  audioStatus,
  soundCheck,
  subscribeAudioStatus,
} from '@/autopilot/alert';
import { isHeldMP } from '@/autopilot/autoswap';
import { describeLastBackup, lastBackupAt } from '@/autopilot/backup';
import { checklist } from '@/autopilot/checklist';
import { describeMode } from '@/autopilot/describe';
import { SKIP_TEXT, latestActivity } from '@/autopilot/events';
import { loadPendingSearch } from '@/autopilot/nextll';
import { PlanReview, checkPlan, planReview } from '@/autopilot/plancheck';
import { NO_REFUSALS } from '@/autopilot/refusal';
import { secondsUntil, syncedParkTime } from '@/autopilot/schedule';
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
import ResortContext from '@/contexts/ResortContext';
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

import useScopeGuard from '../useScopeGuard';
import Activity from './Activity';
import BackupRestore from './BackupRestore';
import BookingDetails from './BookingDetails';
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
 * How near a held pass's window must close before its countdown turns amber.
 * A choice about walking time, not a Disney fact, and unverified: how late a
 * turnstile still takes a pass past its window has never been observed.
 */
export const LAPSE_WARNING_MINUTES = 30;

/**
 * A backup older than this is asked for again. Safari may clear a site's data
 * after about a week unvisited, which is the loss a backup is for.
 */
const BACKUP_STALE_DAYS = 7;

/** One go/no-go line: what it read, and whether that is ready. */
function Ready({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span
        aria-hidden
        className={`w-4 shrink-0 text-center font-bold ${ok ? 'text-green-700' : 'text-amber-700'}`}
      >
        {ok ? '✓' : '!'}
      </span>
      <span className={ok ? 'text-gray-700' : 'font-semibold text-amber-900'}>
        {children}
      </span>
    </li>
  );
}

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
    skipCounts,
    bookedCount,
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
  const { park, setPark } = use(ParkContext);
  const { bookingDate } = use(BookingDateContext);
  const { ll } = use(ClientsContext);
  const { goTo } = use(NavContext);
  const resort = use(ResortContext);
  const { guard, dialog: scopeDialog } = useScopeGuard();
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
  // Only on the day itself: the engine bursts for drops on no other date, so a
  // "next drop" for a later one named a burst that never comes.
  const nextDrop = isToday ? upcomingTimes(park.dropTimes)[0] : undefined;
  // How long a live pass has left, today only, and only once its window is
  // open. A spent pass -- ridden, or with nobody left on it -- stays on the
  // list, since it holds a slot, but counts nothing down.
  const nowTime = syncedParkTime();
  const minutesLeft = (lane: LLMP): number | undefined => {
    if (!isHeldMP(lane, parkDate())) return undefined;
    if (!lane.start?.time || !lane.end?.time) return undefined;
    if (+nowTime < +lane.start.time || +nowTime >= +lane.end.time) {
      return undefined;
    }
    return Math.ceil(secondsUntil(nowTime, lane.end.time) / 60);
  };
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
  const topSkip = Object.entries(skipCounts).sort((a, b) => b[1] - a[1])[0];
  const lastBackup = lastBackupAt();
  const backupCurrent =
    !!lastBackup && now - lastBackup.getTime() < BACKUP_STALE_DAYS * 86_400_000;
  const armed = targetsHere.filter(t => targetActs(t) && !t.paused).length;
  const paused = targetsHere.filter(t => t.paused).length;
  // The plan for this date saved at another park. The park resets overnight,
  // so a morning can open on a park with nothing watched while the whole day
  // sits at another; Today names it rather than switching on its own.
  const elsewhere = useMemo(() => {
    const counts = new Map<string, number>();
    for (const target of targets) {
      if (target.date !== bookingDate) continue;
      if (!target.parkId || target.parkId === park.id) continue;
      counts.set(target.parkId, (counts.get(target.parkId) ?? 0) + 1);
    }
    return resort.parks
      .filter(p => counts.has(p.id))
      .map(p => ({ park: p, count: counts.get(p.id)! }));
  }, [targets, bookingDate, park.id, resort]);
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
      subhead={<ContextStrip interactive />}
      ref={ref}
    >
      {freshness !== undefined && (
        <p
          className={`mt-3 mb-0 text-sm ${freshness > 5 ? 'font-semibold text-amber-800' : 'text-gray-600'}`}
        >
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
        {/* The park morning's go/no-go, while it is still off: each line
            reads its own signal, and the sound row and the switch below
            finish it. It goes once Autopilot is on. */}
        {!enabled && isToday && (
          <ul
            aria-label="Before you start"
            className="mt-3 mb-0 flex list-none flex-col gap-1.5 border-t border-gray-200 pt-3 pl-0 text-sm"
          >
            <Ready ok={armed > 0}>
              {armed > 0
                ? `Plan: ${armed} armed at ${park.name}`
                : targetsHere.length > 0
                  ? `Plan: none armed at ${park.name}, so it would only alert`
                  : `Plan: none at ${park.name} today`}
            </Ready>
            <Ready ok={!dryRun}>
              {dryRun
                ? 'Dry run: on, so nothing will be booked'
                : 'Dry run: off, so it will book'}
            </Ready>
            <Ready ok={authStore.getStatus() === 'valid'}>
              {authStore.getStatus() === 'valid'
                ? 'Sign-in: lasts past 5 PM today'
                : 'Sign-in: sign in again before starting'}
            </Ready>
          </ul>
        )}
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
        {/* The answer to "is it working?" in one line: checks run, nothing
            booked, and the reason that has come up most. The full tally stays
            in Activity. */}
        {enabled && status.polls > 0 && bookedCount === 0 && (
          <p className="mt-2 mb-0 text-sm text-gray-600">
            {topSkip
              ? `Nothing booked yet. Most often, ${SKIP_TEXT[topSkip[0]] ?? topSkip[0]} (${topSkip[1]}×).`
              : 'Nothing booked yet, and nothing it watches has come up.'}
          </p>
        )}
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

      {/* Not on the day itself, where the park-morning check in the status
          card does this job -- except with nothing saved at all, which is a
          first run whatever the date. */}
      {(!isToday || targets.length === 0) && (
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
            {/* The one protection against Safari clearing the plan. Backup is
                its own screen because the share sheet opens only from a tap
                made there. */}
            {targets.length > 0 && (
              <li className="flex min-h-11 items-center justify-between gap-2 py-1.5">
                <span className={backupCurrent ? '' : 'font-semibold'}>
                  {backupCurrent ? '✓' : '○'} Last backup:{' '}
                  {describeLastBackup(lastBackup)}
                </span>
                {!backupCurrent && (
                  <Button type="small" onClick={() => goTo(<BackupRestore />)}>
                    Back up
                  </Button>
                )}
              </li>
            )}
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
                Book again at:
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
                Next scheduled drop:
              </span>{' '}
              <Time
                time={nextDrop}
                className="font-display text-2xl leading-tight font-bold [&_span_span]:text-sm"
              />
            </p>
          )}
        </div>
      )}
      {!isToday && (
        <p className="mt-3 mb-0 text-sm text-gray-600">
          Autopilot checks a later date steadily, not in bursts at drops. When
          booking opens at 7:00, NextLL or booking by hand is faster.
        </p>
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
            {held.map(lane => {
              const left = minutesLeft(lane);
              return (
                <li key={lane.id}>
                  {/* The pass itself, a tap from here: changing one used to mean
                    the Plans tab, the date, then the row. */}
                  <button
                    className="flex w-full overflow-hidden rounded-2xl border border-gray-300 bg-white text-left"
                    onClick={() => goTo(<BookingDetails booking={lane} />)}
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
                        {/* A reminder, not a promise: nothing acts on it, and the
                        redeemed state is only as fresh as the last Plans. */}
                        {left !== undefined && (
                          <span
                            className={`text-xs ${left <= LAPSE_WARNING_MINUTES ? 'font-bold text-amber-800' : 'text-gray-600'}`}
                          >
                            {' '}
                            &middot; window ends in {left} min
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="flex items-center border-l border-dashed border-gray-400 px-3.5 text-sm text-gray-600">
                        {' '}
                        &mdash; no return time
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-label="Plan">
        {/* "Watching", as Configure says: "Plan" beside the Plans tab named
            Autopilot's list and Disney's itinerary alike. */}
        <h3 className="mt-5 mb-0 font-bold">Watching ({targetsHere.length})</h3>
        {targetsHere.length === 0 && elsewhere.length > 0 ? (
          <div className="mt-2 rounded-2xl border border-gray-300 bg-white p-3.5 text-sm">
            <p className="my-0">
              Nothing watched at {park.name} on this date, but this date&rsquo;s
              plan is at{' '}
              {elsewhere
                .map(({ park, count }) => `${park.name} (${count})`)
                .join(' and ')}
              .
            </p>
            {/* Never switched on its own: an unannounced park change is a
                silent change of its own. Two parks are both named. */}
            <div className="mt-2 flex flex-wrap gap-2">
              {elsewhere.map(({ park: other }) => (
                <Button
                  key={other.id}
                  type="small"
                  onClick={() => guard(other.name, () => setPark(other))}
                >
                  Switch to {other.name}
                </Button>
              ))}
            </div>
          </div>
        ) : targetsHere.length === 0 ? (
          <div className="mt-2 text-sm text-gray-600">
            <p className="my-0">
              Nothing watched at {park.name} on this date. Configure is where a
              plan starts.
            </p>
            {/* With nothing saved anywhere, this may be a phone whose storage
                Safari cleared -- and a backup puts the plan back. */}
            {targets.length === 0 && (
              <div className="mt-2">
                <Button type="small" onClick={() => goTo(<BackupRestore />)}>
                  Restore a backup
                </Button>
              </div>
            )}
          </div>
        ) : (
          <>
            <p className="mt-0.5 mb-2 text-xs text-gray-600">
              {armed} armed
              {paused > 0 ? `, ${paused} paused` : ''}
            </p>
            {/* Running with nothing armed can only ever alert, and the only
                sign of it was the small grey count above. */}
            {enabled && armed === 0 && (
              <div className="mb-2 rounded-2xl bg-amber-100 p-3.5 text-sm font-semibold text-amber-900">
                <p className="my-0">
                  Nothing is armed, so Autopilot will only alert.
                </p>
                <div className="mt-2">
                  <Button type="small" onClick={() => goTo(<Configure />)}>
                    Open Configure
                  </Button>
                </div>
              </div>
            )}
            <ul className="divide-y divide-gray-200 overflow-hidden rounded-2xl border border-gray-300 bg-white">
              {plan.map(target => (
                <li key={target.experienceId}>
                  <button
                    className="flex w-full items-center gap-3 px-3.5 py-3 text-left"
                    onClick={() =>
                      goTo(
                        <Configure
                          focus={{
                            kind: 'target',
                            experienceId: target.experienceId,
                          }}
                        />
                      )
                    }
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
                  </button>
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
      {scopeDialog}
    </Tab>
  );
}
