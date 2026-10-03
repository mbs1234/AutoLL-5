# The new look

What AutoLL-5 changes about how the app looks, and the rules it keeps while
doing it. The mockups it follows are on a private design canvas; this file is
the part of them that lives in the repository.

Changes to what the screens say and do are a separate piece of work, with its
own rules: [USABILITY.md](USABILITY.md).

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
| 2 | Today | a status card, the switch beside Pocket it, four tiles, held passes as tickets, the plan with rank badges | merged (#2) |
| 3 | Pocket mode | the next drop at full size, the checks and the latest event, laid out in the gaps of the target's ring | merged (#3) |
| 4 | NextLL | the search as a card with the held time at full size; Done green, Stop looking red; collapsible sections as cards | merged (#4) |
| 5 | Tip board | Book and Drop as cards, quiet section labels, the attractions as a card, return times as chips in the park's colour | merged (#5) |
| 6 | Times | each land as a card under a quiet label in its own colour, its kinds as small labels; waits and show times in soft boxes in the display face, with digits that keep their width; the show-times screen as a card | merged (#32) |
| 7 | Plans | each day as a quiet label that stays on screen while its plans scroll, on the page's own paper; the day's plans as one card with hairline rules | merged (#33) |
| 8 | Configure | its section headings in bold, as Today's are; the add list and the not-on-today's-list list as cards of rows, the add rows the same buttons without their borders; rounder target cards, filter box, notices and undo strip | merged (#34) |
| 9 | Plan Check | its headings in bold, as Today's are; the summary, each item, the connection result, the party result and the doubts panel as rounded boxes, as Today's notices are | merged (#35) |
| 10 | Activity | its headings in bold, as Today's are; the log, the skip counts and the learned drop times each as a card with hairline rules; each log line's time in semibold | merged (#36) |
| 11 | Booking screens | the return window as the biggest thing on them, in the display face, under a small label, still one element that reads "Arrive by: 10:35 AM – 11:35 AM"; Your Lightning Lanes as a card; their headings in bold; rounder notices and the cancel dialog | merged (#37) |
| 12 | Settings | the menu rounder, with hairline rules and a shadow; Party Selection's choice as a card of rows; its and Backup and Restore's headings in bold; the picked backup file as a card | merged (#38) |
| 13 | Timeline | Plans and Targets as white panels under quiet labels, with the hours on the page beside them; rounder bars in the same colours; Any time as a card; the intro at reading size | merged (#40) |

**One deliberate departure from the mockups.** They put Today's main actions in
a bar along the bottom. The switch stays in the page instead: a bar there sits
directly above the tabs, where a thumb reaching for a tab would find Stop. The
full-width switch keeps its place under the status card, with Pocket it beside
it while Autopilot runs.

**Left out on purpose.** The tip board mockup's Tier 1 / Other / Starred
switch would be a new filter, not a new look, so it is not part of these
slices. The mockups' single tappable park, date and party chip likewise: the
header keeps its separate controls until that is built as behaviour.

**Every screen is now redrawn.** The Timeline came last, once AutoLL-3's 1.8.0
had arrived by merge, since that release redrew the same component.

**The user guide's screenshots** show the new look. All 21 were retaken
together once the new look's slices and the usability work had landed, from the
harness at 390 × 844, by `scripts/guide-shots.mjs`. Run it again, with the
harness running, after any change a screenshot shows.

Each is its own pull request, checked in the harness at phone width before it
merges. When AutoLL-3 changes a screen a slice has redrawn, the fix is re-made
in the new screen inside the merge that brings it — see
[docs/SYNC.md](SYNC.md).

## Re-made in a sync

What an AutoLL-3 change needed here to keep working in the new look, made inside
the merge that brought it:

- **1.4.3.** The tab buttons are narrower (`px-1`, `min-w-12`), so five tabs
  and the gear, which is now part of the tab row, fit a 360 px screen. In the
  dialog that asks before a park or day switch moves a running Autopilot,
  **Switch** is drawn in ink: with both buttons quiet, nothing said which one
  acts.
- **1.4.5.** Disney pushing back has its own states in the new screens. While
  Autopilot waits after a 429, the status card's pill and the footer dot are
  amber, and the card says when it checks again. The pocket screen's pill turns
  amber too, with the time beneath it, and is a rounded box rather than a
  capsule, since its words run to two lines on a narrow phone. The refusal box
  is gone, as in AutoLL-3: a refusal stops everything, and the red pill and the
  stop line say so. The "user beware" note beside each start button is an amber
  card, like this build's other notices. The two tests of the old refusal box
  and the old stop line now read the new ones.
- **1.4.6.** NextLL's green "stopped checking" line sits in the search card
  like its other lines. The card's own "It keeps looking for an earlier time
  until you tap Done" now shows only while a search with no time set is
  running, since a search with a time stops at its window; its test now covers
  both cases.
- **1.5.1.** The park-morning check in the status card names when the sign-in
  ends, "Sign-in: lasts until 6:42 PM", from the auth store's new `expiresAt()`,
  where it could say only "lasts past 5 PM today". One that ends before 5 PM
  says when, and asks for a new sign-in. In the settings menu, this build's
  line on what session-only login does stays beneath AutoLL-3's new session
  line. The readiness list's sound line with its **Test** button, and the
  passkey line naming where to tap in, merged into this build's Today unchanged.
- **1.6.0.** **Restart autopilot** is a small button under the stop line in the
  status card, which keeps this build's spacing. The stop's own paragraph no
  longer ends with the two taps a restart took, and its test of them is replaced
  by AutoLL-3's tests of the button. The readiness list's return-windows step and
  kept buttons merged into this build's Today unchanged, and the guide points at
  **Watching** for each window, where AutoLL-3's says the plan. This build's own
  backup line still offers **Back up** only once the last backup is a week old,
  as slice 3 chose. (Since changed: it offers it always, as the owner chose on
  2026-10-01; see USABILITY.md.)
- **1.7.0 to 1.8.1.** A pocketed NextLL search fills the pocket screen's status
  block, in this build's type, with only the sound and screen chip below it
  while it runs: the armed and booked counts are the day plan's. NextLL's
  **Pocket it** is drawn as Today's, in ink with the lock, first in a row
  beside Done or Stop looking. The refresh bar is the park's colour, since the
  white AutoLL-3 draws on its coloured header would not show on this build's
  paper one. Today's awake line and **Pocket it** go once a run has stopped,
  in the status card and beside the switch where this build has them, and the
  test of the unrecognised-attraction notice now finds it by its own words, as
  the readiness list names those attractions too. The timeline arrives whole,
  still in the foundation's look; its slice is next. This build had both of
  1.8.1's Configure fixes already. Its card scroll is now once a card each
  visit, so a card the filter hides and shows again does not move the screen,
  and AutoLL-3's tests of the undo and the scroll run here, with this build's
  own test standing in for the one that read AutoLL-3's markup. The guide
  takes AutoLL-3's text where its screens are this build's too; it lists no
  rough edges, since this build had fixed Plan Check's two already.
- **1.8.2.** Nothing to re-make: Plan Check's verb and its buttons on lines of
  their own were this build's code already, and merged without a change.
  AutoLL-3's test of the buttons runs here. The guide takes AutoLL-3's
  rough-edges line, none as of 1.8.2, with this build's link, and its Plan
  Check caption, which this build's own screenshot fits.
- **AutoLL-3 #94, after 1.8.2.** The Home flake fix, tests only. This build's
  first Home test ends at its own cancel confirmation and its Plans title, so
  the new `settled()` follows those.
- **AutoLL-3 #95.** Ten more tests end with `settled()`, tests only. It merged
  without a conflict: in this build's own Plan Check and ChangeBookingTime
  tests, each landed at the end of the test of the same name. Nine of this
  build's own tests that also ended mid-load end with it too, in a commit of
  their own.
