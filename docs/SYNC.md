# Keeping AutoLL-5 in step with AutoLL-3

Written when this build was made from AutoLL-3 1.4.1.

AutoLL-5 exists so the new look can be built without putting it in the build
that goes to the park. That only works if everything *except* the look stays
AutoLL-3's. A redesign tested against an older engine than the park's is being
tested against the wrong thing.

## What the three are

|  | AutoLL-3 | AutoLL-4 | AutoLL-5 |
|---|---|---|---|
| Role | the build that has booked in a park | the fallback | the new look, being built |
| Talks to Disney | its own way | differently from AutoLL-3 | exactly as AutoLL-3 does |
| Screens | the current ones | AutoLL-3's | redrawn here, one at a time |
| Storage | `autoll3.*`, tags `autoll3-` | `autoll4.*`, tags `autoll4-` | `autoll5.*`, tags `autoll5-` |
| Origin | `mbs1234.github.io/AutoLL-3` | `mbs1234.github.io/AutoLL-4` | `mbs1234.github.io/AutoLL-5` |

AutoLL-5 talks to Disney exactly as AutoLL-3 does, so it is not a fallback for
AutoLL-3 the way AutoLL-4 is: a change on Disney's side that stops one stops
both. What it protects is AutoLL-3's screens from the redesign's mistakes.

**Run only one build at a time.** They share Disney's origin and its per-page
rate limit, so two live engines contend for the same reservations and the same
five requests a second.

## The rule

The owner's, when this build was made: **bug fixes and everything else stay in
step across all three builds; only the new look lives here alone.** Widened
once since: the usability changes to this build's screens live here too
([USABILITY.md](USABILITY.md)), in the screens and nowhere under them. In
practice:

- **A fix is made in AutoLL-3 first.** Once it is verified there and the owner is
  happy with it, it goes to AutoLL-4 and to AutoLL-5, each by merge.
- **A fix found here, to anything but the new look, is still made in AutoLL-3.**
  Branch from AutoLL-3's `main`, not from this one, fix it there, and let it
  arrive here with the next merge. A fix made here to shared code is stranded:
  AutoLL-3 cannot take it without taking the new look too (below), and copying
  it across by hand gives git two versions of one change that it cannot
  recognise as one.
- **The new look is made here**, in pull requests against this `main`, and
  so are the usability changes, in the UI layer only. One that needs the
  engine changed is an AutoLL-3 change.

## Syncing is a merge

Once per clone (this clone has it already):

```bash
git remote add autoll3 https://github.com/mbs1234/AutoLL-3.git
```

Then, per sync:

```bash
git fetch autoll3
git log --oneline HEAD..autoll3/main     # what AutoLL-3 has that this does not
git switch -c sync-autoll3 && git merge autoll3/main
```

Open that branch as a pull request and **merge it with a merge commit, never a
squash.** Squashing discards the ancestry, so `git log HEAD..autoll3/main`
reports the same commits as unmerged forever and every later sync re-conflicts
the whole tree. Adapt a change *inside* the merge that brings it, never as a
separate hand-made copy.

## Which way merges go

- **AutoLL-3 → AutoLL-5** is the routine.
- **AutoLL-5 → AutoLL-3 never happens as a routine.** A merge from here carries
  the whole new look into the park build at once, together with everything else
  that differs. If the owner decides the new look should become AutoLL-3's, that
  is a decision with its own review and release, not a sync.
- **AutoLL-4 → AutoLL-5 never happens at all.** AutoLL-4 talks to Disney
  differently, and git cannot keep the two ways apart: a merge from AutoLL-4
  would bring its mechanism here with every test green. AutoLL-4's own
  `docs/SYNC.md` explains why. The rule here is simply that nothing is merged
  from AutoLL-4.

## What differs, and should

| what | why |
|---|---|
| `src/appIdentity.ts` | the four values: `APP_NAME`, `APP_SLUG`, `APP_SHORT`, `APP_ICON` |
| `package.json`, `package-lock.json` | `name` and `repository`, which cannot import a constant |
| `harness/index.html` | a static `<title>`; dev-only |
| `.github/workflows/deploy.yml` | `PAGES_ORIGIN` and the branding of the files it publishes — nothing else |
| `.github/workflows/upstream-drift.yml` | this build's own |
| `.github/dependabot.yml` | absent here on purpose. Dependencies arrive from AutoLL-3 with every merge, and a Dependabot pull request here would put this build's lockfile out of step with AutoLL-3's. If a sync reports a conflict on it, keep it deleted |
| the docs, **in part** | `README.md`, `FORK.md`, `SECURITY.md`, `docs/RELEASING.md` and this file are this build's own. The user guide, the roadmap and `FUTURE.md` take AutoLL-3's content with this build's name, and are *ported* where a redrawn screen changes what they describe |
| the new look | whatever the redesign has changed so far — the reason this build exists. [NEW-LOOK.md](NEW-LOOK.md) lists it slice by slice |
| `docs/user-guide/*.png`, `scripts/guide-shots.mjs` | this build's own screenshots, in the new look, and the script that takes them. A sync that brings a new or changed screenshot from AutoLL-3 keeps this build's, and the shot is retaken here |
| the usability work | what the screens say and do, in `src/components` and screen-only hooks. [USABILITY.md](USABILITY.md) lists it slice by slice |

Everything else should be identical to AutoLL-3's. When it is not, one of them
is wrong.

## Where a merge needs care

**The identity file.** Taking AutoLL-3's side of `src/appIdentity.ts` renames
this build AutoLL-3, repoints every stored key at AutoLL-3's, and hands a Disney
session to AutoLL-3's responder page. `appIdentity.test.ts` compares the identity
with `package.json`, so it catches the mistake unless both files are taken wrong
together. Read both in every merge that touches either.

**Screens the new look has redrawn.** A fix AutoLL-3 makes to one of its screens
can reach this build in two ways, and neither is safe by default:

1. **It conflicts.** Resolve it by making the same fix in the new screen, not by
   taking either side whole. Taking AutoLL-3's side undoes the redesign of that
   screen; taking this side drops the fix.
2. **It merges silently.** If the old screen's file is still in the tree but no
   longer used, the fix lands in it cleanly and does nothing. Before each merge,
   list what AutoLL-3 changed under `src/components/` and check each change
   against the screen that replaced it:

   ```bash
   git diff --stat HEAD...autoll3/main -- src/components/
   ```

**Tests travel with the fix.** If an AutoLL-3 fix comes with a test of the old
screen, the test is adapted to the new screen inside the merge. A fix whose test
was deleted to make the merge green has not been ported.

**Read the files git merged without asking.** A clean merge is not a reviewed
merge. Prose is the usual casualty: a sentence that means *this build* arrives
from AutoLL-3 saying "AutoLL-3".

## When to merge

**Soon after a change is verified on AutoLL-3.** This is where the new look is
tested, and tested against an older engine than the park's it is being tested
against the wrong thing.

**Not on a park day on which this build is the one in the pocket.**

The one thing that does go wrong is forgetting. That is what
`.github/workflows/upstream-drift.yml` is for: it runs weekly, counts what is
waiting, and fails only when something has sat unmerged past a seven-day soak.
It never merges anything, and it cannot tell you a waiting commit is safe. Run it
on demand from the Actions tab, or locally:

```bash
git fetch autoll3 && git rev-list --count HEAD..autoll3/main
```

## Checking they are in step

The sensor path must stay byte for byte AutoLL-3's. Once this build is in step,
the first command prints nothing and the second prints only `deploy.yml`'s
branding lines:

```bash
git fetch autoll3
git diff autoll3/main -- src/api/
git diff autoll3/main -- .github/workflows/deploy.yml
```

Then the whole tree:

```bash
git diff --stat autoll3/main
```

Anything it lists that is not in the table above is either drift worth resolving
or part of the new look — and if it is the new look, it should be possible to say
which screen.
