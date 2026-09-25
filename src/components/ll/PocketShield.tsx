import { use, useEffect, useRef, useState, useSyncExternalStore } from 'react';

import {
  AudioStatus,
  audioStatus,
  subscribeAudioStatus,
} from '@/autopilot/alert';
import { AutopilotEvent, latestActivity } from '@/autopilot/events';
import { MODE_TEXT } from '@/autopilot/status';
import {
  ScreenAwakeStatus,
  screenAwakeStatus,
  subscribeScreenAwakeStatus,
} from '@/autopilot/wakelock';
import { targetActs } from '@/autopilot/watchlist';
import { Time } from '@/components/Time';
import TopAutopilotContext from '@/contexts/TopAutopilotContext';
import { LockIcon } from '@/icons/LineIcons';

import {
  BOX_POSITIONS,
  INITIAL,
  INITIAL_TOUCH_GESTURE,
  INITIAL_WIDE_TOUCH,
  TAPS_REQUIRED,
  TouchGesturePhase,
  clearNormalProgress,
  mayStillCompleteWideTouch,
  nextPosition,
  onHit,
  onMiss,
  onWideTouch,
  onWideTouchCredit,
  reduceTouchGesture,
  reportedMajorRadius,
  reportedMinorRadius,
} from './pocketGuard';

/** Compatibility clicks arrive immediately after the touch that created them. */
const COMPATIBILITY_CLICK_MS = 1_000;

const SOUND_TEXT: Record<AudioStatus, string> = {
  armed: 'Sound on',
  idle: 'No sound',
  unsupported: 'Sound unavailable',
};

/** The latest event, on the dark shield: the same levels as LatestEvent. */
const LATEST_CLASS: Record<AutopilotEvent['level'], string> = {
  info: 'text-gray-100',
  warn: 'text-amber-300',
  error: 'text-red-300',
};

const SCREEN_TEXT: Record<ScreenAwakeStatus, string> = {
  held: 'Screen held',
  idle: 'Screen may sleep',
  unsupported: 'Screen wake unavailable',
};

/** Largest usable major and minor axes reported anywhere in this event. */
function touchRadii(event: React.TouchEvent): {
  minorRadius?: number;
  majorRadius?: number;
} {
  let minorRadius = 0;
  let majorRadius = 0;
  for (const list of [event.touches, event.changedTouches]) {
    for (let i = 0; i < list.length; ++i) {
      const touch = list[i] as
        | { radiusX?: number; radiusY?: number }
        | undefined;
      minorRadius = Math.max(
        minorRadius,
        reportedMinorRadius(touch?.radiusX, touch?.radiusY) ?? 0
      );
      majorRadius = Math.max(
        majorRadius,
        reportedMajorRadius(touch?.radiusX, touch?.radiusY) ?? 0
      );
    }
  }
  return {
    minorRadius: minorRadius || undefined,
    majorRadius: majorRadius || undefined,
  };
}

/** Primary contact position, used only to distinguish a tap from a drag. */
function touchPoint(
  event: React.TouchEvent
): { x: number; y: number } | undefined {
  const touch = (event.changedTouches[0] ?? event.touches[0]) as
    | { clientX?: number; clientY?: number }
    | undefined;
  return touch?.clientX === undefined || touch.clientY === undefined
    ? undefined
    : { x: touch.clientX, y: touch.clientY };
}

/**
 * What the phone shows while it is in your pocket.
 *
 * Autopilot holds a screen wake lock, so a pocketed phone has its display on
 * and its glass live. Today's on/off control is one unconfirmed tap, and a
 * stopped engine says nothing -- `AutopilotStatusRow` already refuses to carry
 * that control for the same reason ("a footer mis-tap should never change
 * booking behaviour"); this extends the idea to the whole screen.
 *
 * It guards nothing in the engine, because it does not need to: the poller runs
 * on a timer and does not care what is rendered. Notifications still arrive and
 * the wake lock is still held, since the page stays visible. The shield is
 * purely what the glass will accept.
 *
 * It is also the screen worth having when you take the phone back out. Rather
 * than blank the display it shows the state in type you can read at arm's
 * length, so a glance answers "is it still working" without lifting the shield
 * at all -- which is the question being asked most of the time.
 */
/** iPhone or iPad Safari, including an iPad that says it is a Mac. */
function onIPhone(): boolean {
  if (typeof navigator === 'undefined') return false;
  return (
    /iP(hone|od|ad)/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

export default function PocketShield({
  onExit,
  wideTouchLearned = false,
  onLearnWideTouch = () => undefined,
}: {
  onExit: () => void;
  wideTouchLearned?: boolean;
  onLearnWideTouch?: () => void;
}) {
  const autopilot = use(TopAutopilotContext);
  const [guard, setGuard] = useState(INITIAL);
  const [wideGuard, setWideGuard] = useState(INITIAL_WIDE_TOUCH);
  const shield = useRef<HTMLDivElement>(null);
  const gesture = useRef(INITIAL_TOUCH_GESTURE);
  const lastTouchAt = useRef(-Infinity);
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

  // React's delegated touch listener can be passive in a browser, in which
  // case preventDefault() in the synthetic handler is only a wish. A scoped
  // native listener is the part that actually stops scroll, overscroll and
  // pull-to-refresh while the shield is mounted.
  useEffect(() => {
    const node = shield.current;
    if (!node) return;
    const preventGesture = (event: TouchEvent) => {
      if (event.cancelable) event.preventDefault();
    };
    const events = ['touchstart', 'touchmove', 'touchend'] as const;
    for (const name of events) {
      node.addEventListener(name, preventGesture, { passive: false });
    }
    return () => {
      for (const name of events) {
        node.removeEventListener(name, preventGesture);
      }
    };
  }, []);

  const mode = autopilot?.status.mode ?? 'off';
  const stopped = mode === 'stopped';
  const off = mode === 'off';
  const alarm = stopped || off;
  const alertChannelsHealthy =
    soundStatus === 'armed' && awakeStatus === 'held';
  const armed =
    autopilot?.targetsHere.filter(
      target => targetActs(target) && !target.paused
    ).length ?? 0;
  const box = BOX_POSITIONS[guard.position] ?? BOX_POSITIONS[0]!;
  const wideInProgress = wideGuard.taps > 0;
  const remaining =
    TAPS_REQUIRED - (wideInProgress ? wideGuard.taps : guard.taps);

  const advance = (at = Date.now()) => {
    const result = onHit(guard, at, nextPosition);
    if (result.kind === 'unlocked') onExit();
    else setGuard(result.state);
  };

  const reset = () => {
    setGuard(current => onMiss(current, nextPosition));
  };

  const resetWide = () => setWideGuard(INITIAL_WIDE_TOUCH);

  const clearOrdinaryProgress = () => {
    setGuard(current => clearNormalProgress(current));
  };

  const completeWideAttempt = (at: number) => {
    const result = onWideTouch(wideGuard, at);
    if (result.kind !== 'ignored') {
      setGuard(current => onWideTouchCredit(current, nextPosition));
    }
    if (result.kind === 'unlocked') {
      onLearnWideTouch();
      onExit();
    } else {
      setWideGuard(result.state);
    }
  };

  /**
   * Touch is authoritative. The click a browser synthesises afterwards is
   * explicitly ignored, so a rejected pocket contact cannot become a mouse
   * hit and a valid touch cannot count twice.
   */
  const handleTouch = (
    phase: TouchGesturePhase,
    onTarget: boolean,
    event: React.TouchEvent
  ) => {
    event.stopPropagation();
    if (event.cancelable) event.preventDefault();
    const at = Date.now();
    lastTouchAt.current = at;
    const radii = touchRadii(event);
    const result = reduceTouchGesture(
      gesture.current,
      {
        phase,
        touches: event.touches.length,
        changedTouches: event.changedTouches.length,
        ...radii,
        point: touchPoint(event),
        onTarget,
      },
      {
        ignoreRadius: wideTouchLearned,
      }
    );
    gesture.current = result.state;
    if (result.outcome === 'reset') {
      clearOrdinaryProgress();
    }
    if (result.outcome === 'wide-reset') clearOrdinaryProgress();
    // A gesture can lose wide eligibility after its first invalid event. Keep
    // earlier escape credit only while the live gesture can still recover.
    if (result.state.invalid && !mayStillCompleteWideTouch(result.state)) {
      resetWide();
    }
    if (result.completion === 'normal') {
      resetWide();
      advance(at);
    }
    if (result.completion === 'wide') completeWideAttempt(at);
    if (result.completion === 'invalid') {
      reset();
      resetWide();
    }
  };

  const compatibilityClick = () =>
    Date.now() - lastTouchAt.current <= COMPATIBILITY_CLICK_MS;

  const hitByClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (compatibilityClick()) {
      event.preventDefault();
      return;
    }
    resetWide();
    advance();
  };

  const missByClick = (event: React.MouseEvent) => {
    if (compatibilityClick()) {
      event.preventDefault();
      return;
    }
    reset();
    resetWide();
  };

  const target = autopilot?.status.target;
  const secondsToTarget = autopilot?.status.secondsToTarget;
  const latest = autopilot
    ? latestActivity({
        bookingLog: autopilot.bookingLog,
        lastSkip: autopilot.lastSkip,
        lastHit: autopilot.lastHit,
      })
    : undefined;

  return (
    <div
      ref={shield}
      className={`fixed inset-0 z-50 touch-none select-none overscroll-none ${
        alarm ? 'bg-red-950' : 'bg-gray-950'
      } text-gray-50`}
      style={{ touchAction: 'none', overscrollBehavior: 'none' }}
      onTouchStart={event => handleTouch('start', false, event)}
      onTouchMove={event => handleTouch('move', false, event)}
      onTouchEnd={event => handleTouch('end', false, event)}
      onTouchCancel={event => handleTouch('cancel', false, event)}
      onClick={missByClick}
      data-testid="pocket-shield"
    >
      {/* Everything drawn here ignores the glass: the backdrop and the box are
          the only two things a touch can reach, which is what the counting
          above relies on. The blocks sit in the gaps of the ring the box moves
          around -- above its middle row and below it -- so the box rarely
          lands on the numbers. */}
      <div className="pointer-events-none absolute inset-0 text-center">
        <div className="absolute inset-x-0 top-0 flex items-center justify-center gap-2 pt-7 text-xs font-bold tracking-widest text-gray-400 uppercase">
          <LockIcon className="size-3.5" />
          Pocket mode
        </div>

        <div className="absolute inset-x-6 top-[37%] -translate-y-1/2">
          {alarm ? (
            <>
              <div className="font-display text-5xl font-bold text-red-300">
                {stopped ? 'Stopped' : 'Off'}
              </div>
              <p className="mx-auto mt-3 mb-0 max-w-xs text-base text-red-100">
                {stopped
                  ? 'Autopilot stopped after repeated errors and is no longer checking.'
                  : 'Autopilot is off and is no longer checking.'}{' '}
                Lift the shield and start it again.
              </p>
            </>
          ) : (
            <>
              <span className="inline-flex min-h-9 items-center gap-2 rounded-full bg-green-950 px-3.5 text-base font-bold text-green-300">
                <span
                  aria-hidden
                  className="size-2.5 shrink-0 rounded-full bg-current"
                />
                {MODE_TEXT[mode]}
              </span>
              {target && (
                <div className="mt-4">
                  <div className="text-xs font-bold tracking-widest text-gray-400 uppercase">
                    Checking hard at
                  </div>
                  <Time
                    time={target}
                    className="block font-display text-[5.5rem] leading-none font-bold tracking-tight [&_span_span]:text-2xl [&_span_span]:text-gray-400"
                  />
                  {typeof secondsToTarget === 'number' &&
                    secondsToTarget > 0 && (
                      <div className="mt-1 text-lg font-bold text-green-300">
                        {secondsToTarget < 60
                          ? 'in under a minute'
                          : `in ${Math.round(secondsToTarget / 60)} min`}
                      </div>
                    )}
                </div>
              )}
            </>
          )}
        </div>

        {!alarm && (
          <div className="absolute inset-x-6 top-[63%] -translate-y-1/2">
            <div className="flex flex-wrap justify-center gap-2 text-sm font-semibold">
              <span className="rounded-full border border-white/15 px-3 py-1.5 text-gray-100">
                {armed} armed
                {autopilot?.dryRun ? ' · Dry run' : ''}
              </span>
              <span className="rounded-full border border-white/15 px-3 py-1.5 text-gray-100">
                {autopilot?.bookedCount ?? 0} booked today
              </span>
              <span
                className={`rounded-full border border-white/15 px-3 py-1.5 ${
                  alertChannelsHealthy
                    ? 'text-gray-400'
                    : 'font-semibold text-red-300'
                }`}
                data-testid="pocket-health"
              >
                {SOUND_TEXT[soundStatus]} · {SCREEN_TEXT[awakeStatus]}
              </span>
            </div>
            {latest && (
              <p
                className={`mx-auto mt-4 mb-0 max-w-xs text-base font-semibold ${LATEST_CLASS[latest.level]}`}
              >
                {latest.text}
              </p>
            )}
          </div>
        )}

        <div className="absolute inset-x-6 bottom-0 pb-7">
          {/* A web page cannot cover Safari's own toolbar, and its back
              button ends the run. Guided Access can, and the page cannot tell
              whether it is on -- so this is a reminder, every time. */}
          {onIPhone() && (
            <p className="mt-0 mb-2 text-xs text-gray-500">
              On iPhone, triple-click the side button for Guided Access, which
              keeps Safari&rsquo;s toolbar out of reach.
            </p>
          )}
          {wideInProgress ? (
            <p className="my-0 text-sm text-gray-300">
              Keep using one fingertip and follow the moving box. {remaining}{' '}
              more {remaining === 1 ? 'tap' : 'taps'} to unlock.
            </p>
          ) : (
            <p className="my-0 text-sm text-gray-400">
              Screen guarded. Tap the box {remaining} more{' '}
              {remaining === 1 ? 'time' : 'times'} to unlock.
            </p>
          )}
        </div>
      </div>

      <button
        type="button"
        className="absolute h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-gray-300/80 bg-white/10 font-display text-2xl font-bold transition-[left,top] duration-200"
        style={{ left: `${box.x * 100}%`, top: `${box.y * 100}%` }}
        // Two positions can share an x or a y -- the target moves diagonally
        // between them -- so the index is the only honest way to assert that it
        // moved at all.
        data-position={guard.position}
        aria-label={`Unlock the screen: ${remaining} more ${
          remaining === 1 ? 'tap' : 'taps'
        } needed`}
        onTouchStart={event => handleTouch('start', true, event)}
        onTouchMove={event => handleTouch('move', true, event)}
        onTouchEnd={event => handleTouch('end', true, event)}
        onTouchCancel={event => handleTouch('cancel', true, event)}
        onClick={hitByClick}
      >
        {remaining}
      </button>
    </div>
  );
}
