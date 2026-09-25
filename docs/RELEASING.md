# Building, verifying and releasing AutoLL-5

AutoLL-3's release guide under this build's name, with the few differences a
build kept in step by merge needs. Where this says something AutoLL-3's does
not, the difference is deliberate.

## Development

```bash
npm ci
npm run checkall     # tests, lint, typecheck
npm run harness      # the real screens against fake clients
npm run build
```

[FORK.md](../FORK.md) explains why a plain upstream build does not run and how
the deploy assembles one. [docs/SYNC.md](SYNC.md) governs keeping this build in
step with AutoLL-3, and is the document to read before any sync.
[docs/PLAN.md](PLAN.md) is the booking-intelligence roadmap and the record of
what was decided; [docs/UX-PLAN.md](UX-PLAN.md) is the same for the screens;
[docs/FUTURE.md](FUTURE.md) is what remains, and [ROADMAP.md](../ROADMAP.md) is
what to do about it next. [docs/USER-GUIDE.md](USER-GUIDE.md) is the guide
written for whoever is holding the phone, rather than for whoever is changing
the code. [SECURITY.md](../SECURITY.md) covers token handling.

## Verifying a build

Every deploy writes
[`autoll5-release.json`](https://mbs1234.github.io/AutoLL-5/autoll5-release.json)
and `autoll5-files.sha256` into the published site: the exact revisions the site
is assembled from, plus a SHA-256 of every file served. Point a browser at it
and confirm the build on your phone is the one the repository says it is — or
read the revision off the Settings menu, which names the commit the bundle was
built from.

The strongest check is that a local build of the same commit reproduces the
served bundle byte for byte:

```bash
npm run build
shasum -a 256 dist/bg1.js
curl -s https://mbs1234.github.io/AutoLL-5/bg1.js | shasum -a 256
```

Build the commit the manifest names, not a branch — the build embeds its own
revision, so a build of a different commit will differ for that reason alone.

## Releasing, and rolling back

A tagged release is that pair of manifest files together with the tag, and both
are attached to the [release](https://github.com/mbs1234/AutoLL-5/releases) as
well as served from the site. Re-running the deploy workflow against a tag
rebuilds the same site, which is what makes a rollback a one-command operation
rather than a rebuild from memory:

```bash
gh workflow run deploy.yml --ref autoll5-v1.4.1
```

The release is not complete until `gh release view` lists both manifest files; a
pushed tag on its own does not satisfy the promise above.

A tag deploy restores the *served* site. It does not revert `main` — if the
build being rolled back is wrong rather than merely unlucky, revert the commit
too, or the next push to `main` re-ships it.

### The environment policy a new repository needs

The `github-pages` environment has a deployment branch policy. Where it permits
`main` only, a workflow dispatched against a tag builds correctly and is then
refused at the deploy step — **with no steps recorded and nothing naming the
cause.** AutoLL-3 hit this first and AutoLL-4 hit it again. Here the
`tag: autoll5-v*` policy has to sit beside `main` before the first tag deploy;
if the deploy job ever fails with zero steps, this is why.

### Version numbers

`package.json` carries AutoLL-3's version, because every sync brings AutoLL-3's
`package.json` with it, and this build's releases are tagged `autoll5-v` plus
that version. How releases of the new look itself are numbered is decided with
the first of them.

## Two policy differences from AutoLL-3, both on purpose

**`main` is protected, but not for administrators** — the same settings as
AutoLL-4's: a pull request, a passing `check` run, no force-pushes and no
deletions, with `enforce_admins` off. Once the new look has earned a place on
the phone, this may be the build in the pocket on a park day, and a rule that
makes it slower to repair than the build beside it gets the priority backwards.
Everything still goes through a pull request by default; the owner can go around
it when the situation warrants, and should otherwise not. Check what is actually
set with:

```bash
gh api repos/mbs1234/AutoLL-5/branches/main/protection
```

**Linear history is not required.** Fixes arrive from AutoLL-3 by `git merge`,
and the merge commit is what records that they arrived. Squash it and
`git log HEAD..autoll3/main` reports the same commits as unmerged forever,
re-conflicting the whole tree on every sync afterwards. Requiring linear history
would force exactly that squash. See [docs/SYNC.md](SYNC.md).

## What the deploy inherits

Everything AutoLL-3's does. The installer pages and the runtime module come from
immutable AutoLL-2 revisions pinned in the deploy workflow, so AutoLL-2 must stay
public for this build to publish a complete site. Both pins are AutoLL-3's, and
they move here only when they move there, by merge.

## What the pipeline guarantees

The deploy gates independently on typecheck and the full test suite, and if
either fails the publish is skipped and Pages keeps serving the build already on
your phone.

A green pipeline is not evidence about the sensor path. No test in this
repository loads `src/api/sensor-data.ts` — `jest.config.js` maps it to a mock —
so that file can be wrong in every way and the suite stays green. Here it must
also stay exactly AutoLL-3's: `git diff autoll3/main -- src/api/` should print
nothing, and anything it does print is read by eye before a merge, never after.
