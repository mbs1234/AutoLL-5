import { CALL_TEXT, RefusalState, refusedCalls } from '@/autopilot/refusal';
import { MAX_CONSECUTIVE_FAILURES, syncedParkTime } from '@/autopilot/schedule';
import { MODE_TEXT } from '@/autopilot/status';
import { PollerStatus } from '@/autopilot/usePoller';
import { Time } from '@/components/Time';

export const AUTOPILOT = 'Autopilot';

/**
 * The state as a pill: green while it is watching, red once it has given up,
 * grey while it is off. Colour follows meaning -- the words say the same.
 */
const PILL: Record<PollerStatus['mode'], string> = {
  off: 'bg-gray-100 text-gray-700',
  idle: 'bg-green-100 text-green-700',
  approach: 'bg-green-100 text-green-700',
  burst: 'bg-green-100 text-green-700',
  stopped: 'bg-red-100 text-red-700',
};

/**
 * What the poller is doing and what is in its way: mode, next drop, timing,
 * refusals, backoff, a stopped run.
 */
export default function AutopilotStatus({
  status,
  refusals,
}: {
  status: PollerStatus;
  refusals: RefusalState;
}) {
  // Only while something is running: off, this describes earlier today rather
  // than why nothing is happening now.
  const refused =
    status.mode === 'off' ? [] : refusedCalls(refusals, syncedParkTime());
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
          <span className="sr-only">Status:</span> {MODE_TEXT[status.mode]}
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
      {refused.length > 0 && (
        <div className="mt-3 rounded-xl bg-red-100 p-3 text-red-900">
          <p className="font-semibold">Disney is refusing these requests.</p>
          <p className="mt-1">
            {refused.map(call => CALL_TEXT[call]).join(', ')} &mdash; refused
            repeatedly for over a minute. Autopilot is still watching and will
            still alert you, but it cannot book, move or swap until this clears.
            Book by hand in Disney&rsquo;s app meanwhile.
          </p>
        </div>
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
        <p className="mt-3 mb-0 font-semibold text-red-700">
          Stopped after {status.consecutiveFailures} failed checks
          {status.lastError ? `: ${status.lastError}` : ''}. To retry, tap Turn
          off autopilot, then Turn on autopilot.
        </p>
      )}
    </div>
  );
}
