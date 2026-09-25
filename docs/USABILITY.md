# Usability

The new look ([NEW-LOOK.md](NEW-LOOK.md)) changed how the screens look and
nothing else. This is the other half: changes to what the screens say and do,
so the app is easier to use on a park day. They come from a usability review of
the whole app: its screens, its guide and its own planning documents.

The owner's decision, once the review was done: the usability fixes are made
in AutoLL-5, all of them that are useful. The six defects the review found on
the way were bugs rather than usability, so they went to AutoLL-3 first and
arrived here by merge, as 1.4.3.

## Where these changes may go

**The screens, and hooks only screens use.** Not `src/autopilot`,
`src/providers`, `src/api`, or anything else the engine runs on. The engine
staying byte-for-byte AutoLL-3's is what keeps every merge from AutoLL-3 clean,
and what makes a test of AutoLL-3's engine a test of this one. An idea that
needs the engine changed is made in AutoLL-3 first, or not at all; the list at
the end says which ideas those are.

## The rules

The new look's rules 2, 4 and 5 hold here unchanged. Rules 1 and 3 ("looks
only", "the wording stays") are what this work sets aside, on purpose and in
their place:

1. **A change of behaviour or wording has a test that fails without it.** Each
   slice is checked by running its new tests against the code before it.
2. **Nothing that has to happen inside a tap is rebuilt.** Turning Autopilot
   on, Test sound, Backup's share sheet, Restore's file picker and the
   notifications request each run directly in the tap that asks for them. A
   confirmation step may come *before* such a tap, as its own tap; never an
   `await`, a timer or a navigation between the tap and the call.
3. **Pocket mode keeps its unlock**: three taps on a target that moves after
   each one.
4. **Honest, or absent.** Never imply something is watched, checked or ready
   when it is not. Never switch the park or date without asking. Colour never
   carries a state alone. An inline action only ever moves toward safety:
   turning a safeguard off stays in Configure, which explains it.
5. **Checked in the harness at 360 px** before it merges.

## Slices

| | slice | what changes | state |
|---|---|---|---|
| 1 | Words | Typos and wrong limits; sentences that point somewhere become buttons that go there; Disney's eligibility codes in plain words; dates in words; NextLL's time bounds say what they do; the iPhone alert line; a Plan Check button on its own line; menu rows tappable edge to edge | in review (#10) |
| 2 | Recovery | Errors that stay, with their time, until dismissed; lists that say when they have not loaded instead of that they are empty; the booking screen telling a dropped connection from a sold-out ride; confirmation for Cancel, Log Out and turning Autopilot off; a stopped run that says how to restart, in red on every tab; a note on Today when a sign-in expiry stopped Autopilot; Plans buttons wherever an outcome is in doubt | in review |
| 3 | Today | Tappable passes and plan rows; how long a held pass has left (roadmap item 3, the screen half); a park-morning check in the status card (item 13); the plan's own park named when the header shows another (item 14); no drop time for a date the engine never bursts for, and its two drop times named apart (item 8's honesty half); a line saying why nothing has booked; the readiness list on a first run, with a backup row; a Guided Access reminder in Pocket mode on iPhone | in review |
| 4 | Reach | 44 px tap targets; the park, date and party chip as a control; refreshes that do not cover the screen | planned |
| 5 | Setup | One "What should Autopilot do?" choice per attraction; one meaning per star | planned |
| 6 | NextLL | Who holds each reservation; a warning before leaving a running search; the modify mode shown wherever it applies | planned |
| 7 | Names | One name for each thing, across every screen | planned |

## Decided along the way

Two of the roadmap's open questions came up in slice 3 and were settled the
smaller way. Either can be undone without touching anything else.

- **Item 3, which passes count down.** Today's Held list is left as it is,
  spent passes included, and the countdown is suppressed per row on
  `isHeldMP(booking, parkDate())`. The warning threshold is
  `LAPSE_WARNING_MINUTES` in `Today.tsx`: a choice about walking time, not a
  Disney fact, and unverified.
- **Item 8, which "Next drop" survives.** Both, under names that say what they
  are: **Checking hard at** is the engine's own target, shown only near it, and
  **Next scheduled drop** is the built-in table. On a date other than today
  there is no drop time at all.

## Not here, and why

**Needs the engine, so AutoLL-3 first:** a one-tap "Restart autopilot" (the
poller restarts only when `enabled` changes); naming the ride the Tier 1 hold is
waiting for; keeping "Why nothing was booked" counts across a reload; Pocket
mode for a NextLL search; a chime before a held pass lapses (`alert.ts` is
frozen for the trip). The sign-in's real end time on the readiness list, which
needs the auth store to expose it.

**After the rehearsal's booking morning:** the booking-morning screen. The
roadmap holds it until that morning has shown what is hard about it, and that
reasoning stands here too.

**Decided against, in this repository's documents, and not proposed again:** a
bar of actions along the bottom; one tap that starts the park day and pockets
the phone; a banner for a search that cannot be running; a search that
survives a tab switch; running as a Home Screen app; Autopilot booking a whole
stay by itself; a switch on Today that turns a safeguard off.

## What this means for a sync

More of `src/components` now differs from AutoLL-3, so more of AutoLL-3's
screen fixes will conflict here and have to be re-made in this build's version,
inside the merge that brings them ([SYNC.md](SYNC.md)). What differs is always:

```bash
git diff --stat autoll3/main -- src/components src/hooks
```
