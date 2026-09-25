# The new look

What AutoLL-5 changes about how the app looks, and the rules it keeps while
doing it. The mockups it follows are on a private design canvas; this file is
the part of them that lives in the repository.

## The direction: glance, then act

- **A calm, warm page.** Paper (`#f6f4ef`) and ink (`#1d1b18`) instead of white
  and black. The park's colour no longer fills the header, the tab bar and every
  button; it appears where it says *where you are* — the park chip under each
  title and the selected tab.
- **Colour only where it means something.** Green for go and running, red for
  stop and for errors, amber for dry run and paused. Everything else is quiet.
- **Times are the biggest thing on the screen,** in a display face, with digits
  that keep their width so a countdown does not shuffle its line.
- **The main action is within reach of a thumb,** and there is one per screen.

## The rules

These are why the redesign can happen beside a build that has to work in a
park. Each slice keeps all of them.

1. **Looks only, behaviour never.** A slice changes classes and layout. It does
   not change what a tap does, when it does it, or what the app says.
2. **Nothing that has to happen inside a tap is rebuilt.** iOS allows sound, the
   share sheet and the file picker only as the direct result of a tap, so
   `Button`'s synchronous `onClick`, the audio unlock, Backup's share sheet,
   Restore's file picker and Pocket mode's touch filtering are restyled at
   most. A tap that gains a `setTimeout` or an `await` in front of one of those
   fails silently on a phone with every test still green.
3. **The wording stays.** The tests find things by what they say, so copy is
   left alone while the look changes; changing copy is its own step.
4. **Classes keep their meaning.** Where a test reads a class, it reads meaning
   — `bg-green-700` is "on", `text-red-700` is "an error". The palette is
   therefore redefined under the class names rather than the names rewritten
   (see `src/bg1.css`), and where a test read something the look genuinely
   removed, it is changed to read the same meaning from where it now lives.
5. **Pocket mode keeps its unlock:** three taps on a target that moves after
   each one. Its look may change; the mechanic and its timing do not.

## How it is built

- **`src/bg1.css`** holds the whole palette. Tailwind's gray scale and `black`
  are the warm neutrals; the park and land colours are deep enough to carry
  white text and to be text on paper (every one clears 4.5:1 against white);
  the dry-run and paused fills are deepened for the same reason.
- **The accent.** `Screen` sets `--accent` from the park's theme, and
  `text-accent` / `bg-accent/12` follow it. That is how one class draws the chip
  in Magic Kingdom's colour on one screen and EPCOT's on the next.
- **Fonts** ship with the build, in `src/fonts/`: Figtree for reading, Bricolage
  Grotesque (`font-display`) for titles and times. Latin subsets, about 97 KB
  together, SIL Open Font License. They load from this build's own Pages site —
  never from Google — and fall back to the system font if they cannot.
- **Buttons** are quiet by default: white with a hairline. The full-width
  button is a screen's main action and is drawn in ink. A caller that passes
  `color` still gets exactly that colour.

## Slices

| | slice | what changes | state |
|---|---|---|---|
| 1 | Foundation | palette, fonts, header, tab bar, park chip, default buttons | merged (#1) |
| 2 | Today | a status card, the switch beside Pocket it, four tiles, held passes as tickets, the plan with rank badges | this branch |
| 3 | Pocket mode | the next drop at full size, sound and screen state, the moving target restyled | |
| 4 | NextLL | the ride, what is held against the goal, what the search has done | |
| 5 | Tip board | next booking and next drop up top, return times as chips | |

**One deliberate departure from the mockups.** They put Today's main actions in
a bar along the bottom. The switch stays in the page instead: a bar there sits
directly above the tabs, where a thumb reaching for a tab would find Stop. The
full-width switch keeps its place under the status card, with Pocket it beside
it while Autopilot runs.

**The user guide's screenshots** still show the old look. They are retaken once
the slices have landed, together, rather than screen by screen.

Each is its own pull request, checked in the harness at phone width before it
merges. When AutoLL-3 changes a screen a slice has redrawn, the fix is re-made
in the new screen inside the merge that brings it — see
[docs/SYNC.md](SYNC.md).
