import { use, useEffect, useRef, useState } from 'react';

import { Experience } from '@/api/ll';
import {
  MAX_HELD_MP,
  chooseSwapVictim,
  heldMPToday,
} from '@/autopilot/autoswap';
import { describeMode } from '@/autopilot/describe';
import { WatchTarget } from '@/autopilot/watchlist';
import Button from '@/components/Button';
import { Time } from '@/components/Time';
import Toggle from '@/components/Toggle';
import TargetWindow from '@/components/ll/TargetWindow';
import AutopilotContext from '@/contexts/AutopilotContext';
import BookingDateContext from '@/contexts/BookingDateContext';
import PlansContext from '@/contexts/PlansContext';
import { ParkTime } from '@/datetime';

const DOT = <span aria-hidden> · </span>;

type Mode = 'watch' | 'book' | 'move' | 'book-move' | 'book-then-move';

/**
 * What Autopilot does for one attraction, as one choice.
 *
 * Three chips used to overlap here -- Auto-book, Auto-move and Book then move
 * -- and "Book then move" on beside "Auto-book off" read as if nothing would
 * book. The five combinations that mean something are the choices, named as
 * the summary line names them, each with what it will do. Swap in, Pause and
 * Passkey stay separate: they combine with any of these.
 */
const MODES: { mode: Mode; label: string; hint: string }[] = [
  {
    mode: 'watch',
    label: 'Watch only',
    hint: 'Alert when it comes up; book nothing.',
  },
  {
    mode: 'book',
    label: 'Auto-book',
    hint: 'Book a time inside the window.',
  },
  {
    mode: 'move',
    label: 'Auto-move',
    hint: 'Move a pass you hold to a better time; book nothing new.',
  },
  {
    mode: 'book-move',
    label: 'Auto-book and move',
    hint: 'Book inside the window, then keep moving it earlier.',
  },
  {
    mode: 'book-then-move',
    label: 'Book then move',
    hint: 'Take the first time offered, even outside the window, then move it into the window.',
  },
];

const FLAGS: Record<
  Mode,
  { autoBook: boolean; autoModify: boolean; bookThenMove: boolean }
> = {
  watch: { autoBook: false, autoModify: false, bookThenMove: false },
  book: { autoBook: true, autoModify: false, bookThenMove: false },
  move: { autoBook: false, autoModify: true, bookThenMove: false },
  'book-move': { autoBook: true, autoModify: true, bookThenMove: false },
  'book-then-move': { autoBook: false, autoModify: false, bookThenMove: true },
};

/** Read the way the engine reads the flags: book then move wins. */
function modeOf(target: WatchTarget): Mode {
  if (target.bookThenMove) return 'book-then-move';
  if (target.autoBook && target.autoModify) return 'book-move';
  if (target.autoBook) return 'book';
  if (target.autoModify) return 'move';
  return 'watch';
}

const bound = (time?: ParkTime) => (time ? String(time).slice(0, 5) : '');

/**
 * One end of the return-time window, committed when it is settled rather than
 * on the way there.
 *
 * An empty value is ambiguous: it means "no bound", and it is also the state
 * the field passes through when a bound is cleared to type a different one.
 * Writing it straight through treated the second as the first, and the watch
 * list it writes to is the one the running poller reads -- so backspacing over
 * 15:00 to type 14:00 handed autopilot an unbounded window for as long as the
 * field was empty, and a drop landing in that gap was booked at a time the
 * user had explicitly excluded.
 *
 * A complete time still commits immediately; there is nothing unsafe about it
 * and the responsiveness is worth keeping. Only the empty state waits, and it
 * waits for blur -- the point at which "no bound" is what the user actually
 * meant. Left mid-edit, the previous bound stands, which is the safe way to be
 * wrong.
 */
function BoundInput({
  label,
  value,
  onCommit,
}: {
  label: string;
  value: string;
  onCommit: (value: string) => void;
}) {
  const [cleared, setCleared] = useState(false);
  return (
    <input
      type="time"
      aria-label={label}
      className="min-h-11 rounded-sm border border-gray-300 px-1 py-0.5"
      value={cleared ? '' : value}
      onChange={e => {
        const next = e.target.value;
        if (next === '') return setCleared(true);
        setCleared(false);
        onCommit(next);
      }}
      onBlur={() => {
        if (!cleared) return;
        setCleared(false);
        onCommit('');
      }}
    />
  );
}

/**
 * The plan rank, held locally until it is worth acting on.
 *
 * The same problem `BoundInput` solves, on the field three lines below it.
 * Every keystroke used to reach the watch list the running poller reads:
 * backspacing over "12" passes through "1", and clearing the field to retype
 * deletes the rank outright and falls back to the built-in priority. A tick
 * landing in either gap -- 1.2 seconds apart in a drop burst -- reads the
 * transient as the real plan, and `shouldHoldTierSlot` needs only one hit to
 * act on it, so the day's Tier 1 slot could be held for the attraction being
 * demoted.
 *
 * A value is committed when it is a whole number of at least 1, and an empty
 * field only on blur. `min={1}` is a spinner hint, not a constraint: it does
 * not stop "0" or "-5" being typed, and either outranks everything.
 */
function RankInput({
  label,
  value,
  onCommit,
}: {
  label: string;
  value: number | undefined;
  onCommit: (rank: number | undefined) => void;
}) {
  const [draft, setDraft] = useState<string>();
  return (
    <input
      type="number"
      min={1}
      step={1}
      aria-label={label}
      className="min-h-11 w-16 rounded-sm border border-gray-300 px-1 py-0.5"
      value={draft ?? value ?? ''}
      onChange={e => {
        const next = e.target.value;
        setDraft(next);
        const rank = Number(next);
        if (next === '' || !Number.isInteger(rank) || rank < 1) return;
        onCommit(rank);
      }}
      onBlur={() => {
        const next = draft;
        setDraft(undefined);
        if (next === undefined) return;
        const rank = Number(next);
        if (next === '' || !Number.isInteger(rank) || rank < 1) {
          return onCommit(undefined);
        }
        onCommit(rank);
      }}
    />
  );
}

/**
 * One watched attraction: a line that says what will happen, and the controls
 * underneath it, folded away.
 *
 * A target used to be seven rows tall -- name, five chips, a window, a rank --
 * so four of them filled the screen. The folded line is what a person scans
 * for on a park day: which ride, what Autopilot will do, between which times.
 * The body is for setting that up, which happens once. Native `<details>`, as
 * `Disclosure` is, so the fold needs no state and survives the screen staying
 * mounted under whatever is pushed on top of it.
 *
 * Remove lives inside the body. It used to be the star at the head of every
 * row, one mis-tap from losing a window and a rank with no way back.
 */
export default function TargetCard({
  experience,
  target,
  defaultOpen,
  justAdded,
  onRemove,
}: {
  experience: Experience;
  target?: WatchTarget;
  /** Start unfolded, for the target that was just added. */
  defaultOpen?: boolean;
  /** Just added: it only alerts until an action is chosen, so say so. */
  justAdded?: boolean;
  onRemove: () => void;
}) {
  const {
    toggleAutoBook,
    toggleAutoModify,
    toggleBookThenMove,
    togglePaused,
    toggleAutoSwap,
    togglePasskey,
    setTargetWindow,
    setTargetRank,
  } = use(AutopilotContext);
  const { plans } = use(PlansContext);
  const { bookingDate } = use(BookingDateContext);
  const { id, name } = experience;
  const t: WatchTarget = target ?? { experienceId: id };
  const mode = modeOf(t);
  // Toggles, so only the flags that differ are flipped. Each one is a
  // functional update in the provider, so several in one tap compose.
  function choose(next: Mode) {
    const want = FLAGS[next];
    if (!!t.autoBook !== want.autoBook) toggleAutoBook(id);
    if (!!t.autoModify !== want.autoModify) toggleAutoModify(id);
    if (!!t.bookThenMove !== want.bookThenMove) toggleBookThenMove(id);
  }
  // The engine's own choice of what a swap gives up, from the passes held
  // now. It changes as they do, so it is a statement about now, not a plan.
  const held = heldMPToday(plans, bookingDate);
  const victim = chooseSwapVictim(held, experience);
  // A card opened from elsewhere -- Today's plan, the Timeline, Plan Check, or
  // just added -- is brought into view. It used to open where it was, often
  // below the fold of a long screen.
  const cardRef = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (defaultOpen) cardRef.current?.scrollIntoView?.({ block: 'center' });
  }, [defaultOpen]);
  const autoSwap = !!t.autoSwap;
  const paused = !!t.paused;
  const passkey = !!t.passkey;

  return (
    <details
      ref={cardRef}
      className="group rounded-md border border-gray-300 bg-white"
      open={defaultOpen || undefined}
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 [&::-webkit-details-marker]:hidden">
        <span
          aria-hidden
          className="text-gray-500 transition-transform group-open:rotate-90"
        >
          &#9656;
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{name}</span>
          <span className="block text-xs text-gray-600">
            {paused && (
              <>
                <span className="font-semibold text-amber-800">Paused</span>
                {DOT}
              </>
            )}
            {describeMode(t)}
            {(t.after || t.before) && (
              <>
                {DOT}
                <TargetWindow after={t.after} before={t.before} />
              </>
            )}
            {typeof t.rank === 'number' && (
              <>
                {DOT}Rank {t.rank}
              </>
            )}
            {passkey && <>{DOT}Passkey</>}
          </span>
        </span>
      </summary>
      <div className="border-t border-gray-200 px-3 pb-3">
        {justAdded && mode === 'watch' && (
          <p className="mt-2 mb-0 rounded-sm bg-amber-100 p-2 text-sm font-semibold text-amber-900">
            Just added. It will only alert until you choose what Autopilot
            should do when it comes back.
          </p>
        )}
        <fieldset className="mt-2">
          <legend className="text-sm font-semibold">
            What should Autopilot do?
          </legend>
          <div className="mt-1 flex flex-col">
            {MODES.map(option => (
              <label
                key={option.mode}
                className="flex min-h-11 items-start gap-2 py-1 text-sm"
              >
                <input
                  type="radio"
                  name={`mode-${id}`}
                  className="mt-1 size-4 shrink-0"
                  aria-label={`${option.label} for ${name}`}
                  checked={mode === option.mode}
                  onChange={() => choose(option.mode)}
                />
                <span>
                  <span className="font-semibold">{option.label}</span>
                  <span className="block text-xs text-gray-600">
                    {option.hint}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="mt-2 flex flex-wrap gap-2">
          <Toggle
            on={autoSwap}
            variant="action"
            label="Swap in"
            title={autoSwap ? `Stop swapping in ${name}` : `Swap in ${name}`}
            onToggle={() => toggleAutoSwap(id)}
          />
          <Toggle
            on={paused}
            variant="pause"
            label="Pause"
            onText="Paused"
            offText="Pause"
            title={paused ? `Resume ${name}` : `Pause ${name}`}
            onToggle={() => togglePaused(id)}
          />
          {/* Only a non-Tier-1 attraction can be the day's passkey. It decides
              what gets booked first, which is an action's colour. */}
          {experience.tier === undefined && (
            <Toggle
              on={passkey}
              variant="action"
              label="Passkey"
              title={
                passkey
                  ? `Stop using ${name} as a passkey`
                  : `Use ${name} as a passkey`
              }
              onToggle={() => togglePasskey(id)}
            />
          )}
        </div>
        {autoSwap && (
          <p className="mt-2 mb-0 text-xs text-gray-600">
            {held.some(b => b.facilityId === id) ? (
              'You hold it already, so there is nothing to swap in.'
            ) : held.length < MAX_HELD_MP ? (
              'With a slot free it books instead of swapping.'
            ) : victim ? (
              <>
                With all three held now, it would give up{' '}
                <span className="font-semibold">{victim.name}</span>
                {victim.start.time && (
                  <>
                    {' '}
                    at <Time time={victim.start.time} />
                  </>
                )}{' '}
                &mdash; the pass it ranks lowest, not your Plan rank.
              </>
            ) : (
              'Nothing held now is ranked low enough to give up for it.'
            )}
          </p>
        )}
        {/* The window governs booking, moving and swapping. Leaving a bound
            empty means unbounded on that side. */}
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-gray-600">Return between</span>
          <BoundInput
            label={`Earliest return time for ${name}`}
            value={bound(t.after)}
            onCommit={value => setTargetWindow(id, 'after', value)}
          />
          <span className="text-gray-600">and</span>
          <BoundInput
            label={`Latest return time for ${name}`}
            value={bound(t.before)}
            onCommit={value => setTargetWindow(id, 'before', value)}
          />
        </div>
        <label className="mt-2 flex flex-wrap items-center gap-2 text-sm text-gray-600">
          Plan rank
          <RankInput
            label={`Plan rank for ${name}`}
            value={t.rank}
            onCommit={rank => setTargetRank(id, rank)}
          />
          <span className="basis-full text-xs">
            lower goes first; blank uses the built-in priority
          </span>
        </label>
        <div className="mt-3">
          <Button
            type="small"
            color="bg-gray-200 text-black"
            title={`Stop watching ${name}`}
            onClick={onRemove}
          >
            Stop watching
          </Button>
        </div>
      </div>
    </details>
  );
}
