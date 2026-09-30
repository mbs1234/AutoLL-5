import {
  MAX_CONSECUTIVE_FAILURES,
  syncedParkTimeAt,
} from '@/autopilot/schedule';
import { modeText } from '@/autopilot/status';
import { PollerStatus } from '@/autopilot/usePoller';
import Button from '@/components/Button';
import { Time } from '@/components/Time';

export const AUTOPILOT = 'Autopilot';

/**
 * The state as a pill: green while it is watching, amber while it sits out a
 * wait Disney asked for, red once it has stopped, grey while it is off. Colour
 * follows meaning -- the words say the same.
 */
const PILL: Record<PollerStatus['mode'], string> = {
  off: 'bg-gray-100 text-gray-700',
  idle: 'bg-green-100 text-green-700',
  approach: 'bg-green-100 text-green-700',
  burst: 'bg-green-100 text-green-700',
  waiting: 'bg-amber-100 text-amber-800',
  stopped: 'bg-red-100 text-red-700',
};

/**
 * What the poller is doing and what is in its way: mode, next drop, timing,
 * backoff, a wait Disney asked for, a stopped run and why.
 */
export default function AutopilotStatus({
  status,
  onRestart,
}: {
  status: PollerStatus;
  /** Starts a stopped run again, in one tap. */
  onRestart: () => void;
}) {
  return (
    <div className="text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span
          className={`inline-flex min-h-7.5 items-center gap-2 rounded-full px-3 py-1 font-bold ${PILL[status.mode]}`}
        >
          <span
            aria-hidden
            className="size-2 shrink-0 rounded-full bg-current"
          />
          <span className="sr-only">Status:</span> {modeText(status)}
        </span>
        {status.polls > 0 && (
          <span className="text-[13px] text-gray-500">
            {' '}
            ({status.polls} checks)
          </span>
        )}
      </div>
      {status.target && (
        <div className="mt-3">
          <span className="block text-[13px] font-bold tracking-wide text-gray-600 uppercase">
            Checking hard at:
          </span>{' '}
          <div className="flex items-baseline gap-2">
            {/* The biggest thing on the screen, as in the mockups: the one
                number a glance at a park is for. */}
            <Time
              time={status.target}
              className="font-display text-5xl leading-tight font-bold tracking-tight [&_span_span]:text-lg"
            />
            {typeof status.secondsToTarget === 'number' &&
              status.secondsToTarget > 0 && (
                <span className="ml-auto text-base font-bold text-green-700">
                  {' '}
                  {status.secondsToTarget < 60
                    ? '(in under a minute)'
                    : `(in ${Math.round(status.secondsToTarget / 60)} min)`}
                </span>
              )}
          </div>
        </div>
      )}
      {/* Only while it is running: stopped or off, these are facts about
          earlier rather than a reason for what is happening now. "Cycle"
          because it times the whole tick -- availability, plans, eligibility
          and any booking attempt -- not a single request. */}
      {status.mode !== 'off' &&
        status.mode !== 'stopped' &&
        status.mode !== 'waiting' &&
        status.lastCycleMs !== undefined && (
          <div className="mt-2 text-[13px] text-gray-500">
            <span className="font-semibold">Local timing:</span> last cycle{' '}
            {status.lastCycleMs} ms, average {status.averageCycleMs} ms
          </div>
        )}
      {status.refillWindow && !status.target && (
        <div className="mt-2">
          <span className="font-semibold">Refill window:</span>{' '}
          <Time time={status.refillWindow.start} />
          &ndash;
          <Time time={status.refillWindow.end} />
        </div>
      )}
      {/* A 429 is Disney asking to slow down, and waiting it out is the
          answer: still on, still armed, and back by itself. Saying when is
          what stops the wait reading as the engine having died. */}
      {status.mode === 'waiting' && status.waitUntil !== undefined && (
        <p className="mt-3 mb-0 font-semibold text-amber-800">
          Disney asked Autopilot to slow down, so it is waiting until{' '}
          <Time time={syncedParkTimeAt(status.waitUntil)} />. It is still on and
          still armed, and carries on by itself then.
        </p>
      )}
      {/* Backing off, but not yet stopped.
          `mode` keeps reporting the cadence the policy asked for while the
          poller is actually waiting out an exponential backoff, so a run of
          failures looked exactly like an ordinary idle watch -- just slower.
          There was no way to tell 45s of idle from 60s of capped backoff from
          the screen, which is precisely the question asked when Autopilot
          "seems slow". */}
      {status.mode !== 'stopped' && status.consecutiveFailures > 0 && (
        <p className="mt-3 mb-0 text-amber-800">
          <span className="font-semibold">
            {status.consecutiveFailures} failed{' '}
            {status.consecutiveFailures === 1 ? 'check' : 'checks'} in a row
          </span>{' '}
          &mdash; slowing down between tries
          {status.lastError ? `: ${status.lastError}` : ''}. It speeds back up
          as soon as one succeeds, and gives up after {MAX_CONSECUTIVE_FAILURES}
          .
        </p>
      )}
      {status.mode === 'stopped' && (
        <StoppedLine status={status} onRestart={onRestart} />
      )}
    </div>
  );
}

/**
 * Why the run stopped, and what starting it again means.
 *
 * Starting again is always allowed -- the owner's rule is "user beware", not
 * a lock-out -- so each reason says what the risk of doing so is, and the
 * button sits under that warning rather than instead of it. It used to take
 * two taps, Turn off then Turn on.
 */
function StoppedLine({
  status,
  onRestart,
}: {
  status: PollerStatus;
  onRestart: () => void;
}) {
  return (
    <>
      <p className="mt-3 mb-0 font-semibold text-red-700">
        {whyStopped(status)}
      </p>
      <Button type="small" className="mt-2" onClick={onRestart}>
        Restart autopilot
      </Button>
    </>
  );
}

function whyStopped(status: PollerStatus): React.ReactNode {
  switch (status.stopReason) {
    case 'refused':
      return (
        <>
          Stopped: Disney refused a request, so everything has stopped &mdash;
          Autopilot and any search. You can start again, but give it a while
          first: the next refusal stops everything again.
        </>
      );
    case 'throttled':
      return (
        <>
          Stopped: Disney asked to slow down. You can start again early, but it
          may ask again.
        </>
      );
    case 'session':
      return (
        <>
          Stopped after a long search with nothing booked. Take a break before
          starting again: long searches can make Disney pause the account.
        </>
      );
    default:
      return (
        <>
          Stopped after {status.consecutiveFailures} failed checks
          {status.lastError ? `: ${status.lastError}` : ''}.
        </>
      );
  }
}
