import { act, fireEvent, screen, within } from '@testing-library/react';
import { type ReactElement, createRef } from 'react';

import { createBooking, ep, hm, wdw } from '@/__fixtures__/ll';
import { mk } from '@/__fixtures__/resort';
import { primeAudio, resetAudioForTests } from '@/autopilot/alert';
import { recordBackup } from '@/autopilot/backup';
import { leaseKey, quarantine } from '@/autopilot/lease';
import { savePendingSearch } from '@/autopilot/nextll';
import { planReview } from '@/autopilot/plancheck';
import { holdScreenAwake, releaseScreenAwake } from '@/autopilot/wakelock';
import { SIGN_IN_STOP_KEY } from '@/components/ll/signInStop';
import TabsContext from '@/contexts/TabContext';
import { ParkTime, parkDate } from '@/datetime';
import { PARTY_IDS_KEY } from '@/hooks/useSavedParty';
import kvdb from '@/kvdb';
import { PLAN_CHECK_REVIEW_KEY } from '@/storageNamespace';
import { TODAY, TOMORROW, nav, setTime } from '@/testing';

import Activity from './Activity';
import BackupRestore from './BackupRestore';
import BookingDetails from './BookingDetails';
import Configure from './Configure';
import PlanCheck from './PlanCheck';
import Timeline from './Timeline';
import Today from './Today';
import { BZ, DB, OFF, llExperience, renderScreen } from './screenTestSetup';

// Pins the clock to the repo's canonical TODAY (see @/testing), so "today"
// means the date the fixtures are built for.
setTime('09:00');

const today = () => <Today ref={createRef<HTMLDivElement>()} />;
const setup = (options = {}) => renderScreen(today(), options);

beforeEach(() => {
  localStorage.clear();
  nav.goTo.mockClear();
});

describe('Today', () => {
  it('offers to turn on when off', () => {
    const { setEnabled } = setup();
    screen.getByText('Turn on autopilot').click();
    expect(setEnabled).toHaveBeenCalledWith(true);
  });

  // A second tap while it runs: the button sits beside Pocket it.
  it('turns off on a second tap while running', () => {
    const { setEnabled } = setup({
      enabled: true,
      status: { ...OFF, mode: 'idle', polls: 3 },
    });
    act(() => screen.getByText('Turn off autopilot').click());
    expect(setEnabled).not.toHaveBeenCalled();
    act(() => screen.getByText('Tap again to turn off').click());
    expect(setEnabled).toHaveBeenCalledWith(false);
  });

  // The file's clock is already fake (setTime), so the timers only advance.
  it('lets the second tap lapse after a few seconds', () => {
    const { setEnabled } = setup({
      enabled: true,
      status: { ...OFF, mode: 'idle', polls: 3 },
    });
    act(() => screen.getByText('Turn off autopilot').click());
    act(() => {
      jest.advanceTimersByTime(3000);
    });
    expect(screen.getByText('Turn off autopilot')).toBeVisible();
    act(() => screen.getByText('Turn off autopilot').click());
    expect(setEnabled).not.toHaveBeenCalled();
  });

  it('turns a stopped run off in one tap', () => {
    const { setEnabled } = setup({
      enabled: true,
      status: { ...OFF, mode: 'stopped', consecutiveFailures: 8, polls: 20 },
    });
    act(() => screen.getByText('Turn off autopilot').click());
    expect(setEnabled).toHaveBeenCalledWith(false);
  });

  it('reports the current mode', () => {
    setup({ enabled: true, status: { ...OFF, mode: 'burst', polls: 12 } });
    expect(screen.getByText(/Checking rapidly/)).toBeInTheDocument();
    expect(screen.getByText(/12 checks/)).toBeInTheDocument();
  });

  it('explains why it stopped', () => {
    setup({
      enabled: true,
      status: {
        mode: 'stopped',
        consecutiveFailures: 8,
        polls: 20,
        lastError: 'Request failed',
      },
    });
    expect(screen.getByText(/Stopped after 8 failed checks/)).toBeVisible();
    expect(screen.getByText(/Request failed/)).toBeVisible();
  });

  // The sign-in screen replaces the app, so a run stops with it and comes
  // back simply off, with nothing to say it had been running.
  it('says when a sign-in expiry stopped Autopilot', () => {
    kvdb.set(SIGN_IN_STOP_KEY, Date.now() - 60_000);
    setup();
    expect(
      screen.getByText(
        /Autopilot stopped at .* when your Disney sign-in expired/
      )
    ).toBeVisible();
    act(() => screen.getByRole('button', { name: 'Dismiss' }).click());
    expect(
      screen.queryByText(/when your Disney sign-in expired/)
    ).not.toBeInTheDocument();
    expect(kvdb.get(SIGN_IN_STOP_KEY)).toBeUndefined();
  });

  it('lets that go once Autopilot is on again', () => {
    kvdb.set(SIGN_IN_STOP_KEY, Date.now() - 60_000);
    setup({ enabled: true, status: { ...OFF, mode: 'idle', polls: 1 } });
    expect(
      screen.queryByText(/when your Disney sign-in expired/)
    ).not.toBeInTheDocument();
    expect(kvdb.get(SIGN_IN_STOP_KEY)).toBeUndefined();
  });

  // It said "turn it back on", beside a button that said Turn off: a stopped
  // run is still switched on, so a retry is off and then on.
  it('names the two taps a retry takes', () => {
    setup({
      enabled: true,
      status: { mode: 'stopped', consecutiveFailures: 8, polls: 20 },
    });
    expect(
      screen.getByText(
        /To retry, tap Turn off autopilot, then Turn on autopilot/
      )
    ).toBeVisible();
    expect(screen.getByText('Turn off autopilot')).toBeVisible();
  });

  it('warns when notifications are blocked', () => {
    setup({ notifications: 'denied' });
    expect(screen.getByText(/Notifications are blocked/)).toBeVisible();
  });

  it('explains the iOS limitation when unsupported', () => {
    setup({ notifications: 'unsupported' });
    expect(screen.getByText(/the alert sound is the only alarm/)).toBeVisible();
  });

  it('requests notifications from the pre-trip checklist', () => {
    const { requestNotifications } = setup({
      bookingDate: '2021-10-02',
      notifications: 'default',
    });
    fireEvent.click(screen.getByRole('button', { name: 'Enable' }));
    expect(requestNotifications).toHaveBeenCalledTimes(1);
  });

  it('does not mark Plan Check reviewed merely because its route was opened', () => {
    setup({
      bookingDate: '2021-10-02',
      targets: [{ experienceId: BZ, autoBook: true }],
    });
    const item = screen
      .getAllByRole('listitem')
      .find(element => element.textContent?.includes('Run Plan Check'));
    fireEvent.click(within(item!).getByRole('button', { name: 'Open' }));
    expect(
      screen
        .getAllByRole('listitem')
        .find(element => element.textContent?.includes('Run Plan Check'))
    ).toHaveTextContent('Run Plan Check');
    expect(nav.goTo.mock.calls[0]?.[0].type).toBe(PlanCheck);
  });

  it('marks the rendered clean result reviewed and keeps it reopenable', () => {
    const date = '2021-10-02';
    const targets = [{ experienceId: BZ, autoBook: true }];
    const experiences = [llExperience(BZ), llExperience(DB)];
    setup({ bookingDate: date, targets, experiences });

    const item = screen
      .getAllByRole('listitem')
      .find(element => element.textContent?.includes('Run Plan Check'));
    fireEvent.click(within(item!).getByRole('button', { name: 'Open' }));
    const routed = nav.goTo.mock.calls[0]?.[0] as ReactElement<{
      onReviewed: (review: ReturnType<typeof planReview>) => void;
    }>;
    const review = planReview({
      targets,
      parkId: mk.id,
      date,
      experiences,
      plans: [],
      requireWholeParty: false,
      avoidOverlaps: true,
      dryRun: false,
      tierLimitLifted: false,
    });
    act(() => routed.props.onReviewed(review));

    const reviewed = screen
      .getAllByRole('listitem')
      .find(element => element.textContent?.includes('Plan Check reviewed'));
    expect(reviewed).toHaveTextContent('✓ Plan Check reviewed');
    fireEvent.click(within(reviewed!).getByRole('button', { name: 'Review' }));
    expect(nav.goTo).toHaveBeenCalledTimes(2);
    expect(kvdb.get(PLAN_CHECK_REVIEW_KEY)).toEqual(review);
  });

  it('does not certify a reviewed plan that has a blocker', () => {
    const date = '2021-10-02';
    const targets = [
      {
        experienceId: BZ,
        autoBook: true,
        after: new ParkTime(15),
        before: new ParkTime(10),
      },
    ];
    const experiences = [llExperience(BZ), llExperience(DB)];
    const review = planReview({
      targets,
      parkId: mk.id,
      date,
      experiences,
      plans: [],
      requireWholeParty: false,
      avoidOverlaps: true,
      dryRun: false,
      tierLimitLifted: false,
    });
    kvdb.set(PLAN_CHECK_REVIEW_KEY, review);

    setup({ bookingDate: date, targets, experiences });

    const item = screen
      .getAllByRole('listitem')
      .find(element => element.textContent?.includes('Plan Check found'));
    expect(item).toHaveTextContent('○ Plan Check found 1 blocker');
  });

  it('does not carry a Plan Check acknowledgement to another date', () => {
    const targets = [{ experienceId: BZ, autoBook: true }];
    const experiences = [llExperience(BZ), llExperience(DB)];
    kvdb.set(
      PLAN_CHECK_REVIEW_KEY,
      planReview({
        targets,
        parkId: mk.id,
        date: '2021-10-02',
        experiences,
        plans: [],
        requireWholeParty: false,
        avoidOverlaps: true,
        dryRun: false,
        tierLimitLifted: false,
      })
    );

    setup({ bookingDate: '2021-10-03', targets, experiences });
    expect(screen.getByText(/Run Plan Check before enabling/)).toBeVisible();
  });

  it('shows unresolved protection on Today and routes to its details', async () => {
    await quarantine(leaseKey(BZ, parkDate()), {
      id: 'move-1',
      kind: 'modify',
      to: '11:00:00',
    });
    setup();

    expect(screen.getByRole('alert')).toHaveTextContent(
      '1 unresolved Lightning Lane change needs review.'
    );
    expect(
      screen.getByText(/stopped automatically booking, moving, or swapping/)
    ).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Review protection' }));
    expect(nav.goTo.mock.calls[0]?.[0].type).toBe(Activity);
  });

  it('shows the most recent find', () => {
    setup({
      lastHit: {
        experienceId: BZ,
        name: 'Big Thunder',
        returnTime: new ParkTime(13, 45),
      },
    });
    expect(screen.getByText(/Found Big Thunder at 1:45 PM/)).toBeVisible();
  });

  it('headlines the latest action above the status', () => {
    setup({
      enabled: true,
      status: { ...OFF, mode: 'idle', polls: 12 },
      bookingLog: [
        {
          name: 'Big Thunder',
          at: new ParkTime(9, 47),
          status: 'booked',
          returnTime: new ParkTime(11, 5),
        },
      ],
    });
    expect(screen.getByText(/Booked Big Thunder for 11:05 AM/)).toBeVisible();
  });

  it('headlines the last skip by name', () => {
    setup({
      enabled: true,
      status: { ...OFF, mode: 'idle', polls: 12 },
      lastSkip: {
        name: 'Tower of Terror',
        reason: 'offer-outside-window',
        at: new ParkTime(11, 43),
      },
    });
    expect(
      screen.getByText(
        /Skipped Tower of Terror: the offered time was outside the window/
      )
    ).toBeVisible();
  });

  // A forgotten dry run would look like a broken booker, so it is loud.
  it('shows a prominent banner while a dry run is on', () => {
    setup({ dryRun: true });
    expect(screen.getByText(/Dry run is on/)).toBeVisible();
  });

  // Each notice that names a screen gets a button to it. Configure, not a
  // switch: turning a safeguard off stays on the screen that explains it.
  it('opens Configure from the dry-run banner', () => {
    setup({ dryRun: true });
    const banner = screen.getByText(/Dry run is on/).closest('div')!;
    within(banner).getByRole('button', { name: 'Open Configure' }).click();
    expect(nav.goTo.mock.calls[0]?.[0].type).toBe(Configure);
  });

  it('opens Configure from the unknown-attraction notice', () => {
    setup({ unknownExperienceIds: ['99999'] });
    const notice = screen.getByText(/does not recognise/).closest('div')!;
    within(notice).getByRole('button', { name: 'Open Configure' }).click();
    expect(nav.goTo.mock.calls[0]?.[0].type).toBe(Configure);
  });

  it('says a drop less than a minute off is under a minute away', () => {
    setup({
      enabled: true,
      status: {
        ...OFF,
        mode: 'burst',
        polls: 3,
        target: new ParkTime(9, 1),
        secondsToTarget: 20,
      },
    });
    expect(screen.getByText('(in under a minute)')).toBeVisible();
    expect(screen.queryByText(/in 0 min/)).not.toBeInTheDocument();
  });

  it('shows the next Lightning Lane and the next drop', () => {
    setup({ ll: { nextBookTime: new ParkTime(11) } });
    expect(screen.getByText('Book again at:')).toBeVisible();
    expect(document.querySelector('time[datetime="11:00:00"]')).not.toBeNull();
    expect(screen.getByText('Next scheduled drop:')).toBeVisible();
    expect(document.querySelector('time[datetime="11:30:00"]')).not.toBeNull();
  });

  it('shows the age of the older plan or LL-list refresh', () => {
    const now = Date.now();
    setup({
      experiencesUpdated: now - 3 * 60_000,
      plansUpdated: now,
    });
    expect(screen.getByText(/current as of 3 min ago/)).toBeVisible();
  });

  // Small and grey whatever its age, it read the same at ten minutes stale as
  // at none, and it is the line that says whether to believe the rest.
  it('marks the refresh line once it is stale', () => {
    const now = Date.now();
    setup({ experiencesUpdated: now - 10 * 60_000, plansUpdated: now });
    expect(screen.getByText(/current as of 10 min ago/)).toHaveClass(
      'text-amber-800'
    );
  });

  /*
   * This is the line that tells you whether to trust the rest of the screen, so
   * it must not claim currency it does not have. It used to filter the
   * undefined values out and take the minimum of what was left, which read one
   * loaded context beside one that had never fetched as "both current" --
   * over-claiming in exactly the state where believing it is wrong.
   */
  it.each([
    ['the LL list has never loaded', { plansUpdated: Date.now() }],
    ['plans have never loaded', { experiencesUpdated: Date.now() }],
    ['neither has loaded', {}],
  ])('says nothing about freshness when %s', (_case, updates) => {
    setup(updates);
    expect(screen.queryByText(/current as of/)).not.toBeInTheDocument();
  });

  // Before Plans had loaded it said "Held (0)" and "No Multi Pass
  // reservations yet today" -- a fact about the day it did not know.
  it('says Plans have not loaded rather than that nothing is held', () => {
    const { refreshPlans } = setup({ plansLoaded: false });
    expect(screen.getByText('Plans have not loaded yet.')).toBeVisible();
    expect(
      screen.queryByText(/No Multi Pass reservations/)
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Held (0)')).not.toBeInTheDocument();
    act(() => screen.getByRole('button', { name: 'Try again' }).click());
    expect(refreshPlans).toHaveBeenCalled();
  });

  it('lists what is held on the date, with its return window', () => {
    setup({ plans: [createBooking(hm)] });
    expect(
      screen.getByRole('heading', { name: 'Held (1)' })
    ).toBeInTheDocument();
    expect(screen.getByText(hm.name)).toBeVisible();
    expect(document.querySelector('time[datetime="12:00:00"]')).not.toBeNull();
  });

  /*
   * It used to promise one, in the words "(grace scan until 1:59 PM)" against
   * every held pass -- 119 minutes past the end of the window, a number with no
   * constant, no comment and no origin anybody could trace. Nothing in the
   * engine scans for a lapsing pass, then or now. Telling a user on a park day
   * that something is watching a reservation when nothing is watching it is the
   * worst shape a failure takes in this project, and it was printed on the
   * screen they hold. Warning before a pass lapses is worth building; saying so
   * before it is built is not.
   */
  it('does not promise to watch a pass it is not watching', () => {
    setup({ plans: [createBooking(hm)] });
    expect(screen.queryByText(/grace scan/i)).not.toBeInTheDocument();
    expect(document.querySelector('time[datetime="13:59:00"]')).toBeNull();
  });

  // Roadmap item 3, the half that works with Autopilot off.
  it('counts down a live pass whose window is closing', () => {
    // The clock is at 9:00; this window runs 8:20 to 9:20.
    setup({ plans: [createBooking(hm, { startTime: new ParkTime(8, 20) })] });
    const countdown = screen.getByText(/window ends in 20 min/);
    expect(countdown).toBeVisible();
    expect(countdown).toHaveClass('text-amber-800');
  });

  it('counts nothing down on a pass with nobody left on it', () => {
    setup({
      plans: [
        createBooking(hm, {
          startTime: new ParkTime(8, 20),
          properties: { guests: [] },
        }),
      ],
    });
    expect(screen.getByText(hm.name)).toBeVisible();
    expect(screen.queryByText(/window ends in/)).not.toBeInTheDocument();
  });

  it('counts nothing down before a window opens', () => {
    setup({ plans: [createBooking(hm, { startTime: new ParkTime(10) })] });
    expect(screen.queryByText(/window ends in/)).not.toBeInTheDocument();
  });

  // Changing a held pass used to mean the Plans tab, the date, then the row.
  it('opens a held pass from its ticket', () => {
    const lane = createBooking(hm);
    setup({ plans: [lane] });
    act(() => screen.getByText(hm.name).closest('button')!.click());
    expect(nav.goTo).toHaveBeenCalledWith(<BookingDetails booking={lane} />);
  });

  it("opens a plan row's card in Configure", () => {
    setup({ targets: [{ experienceId: BZ, autoBook: true }] });
    act(() =>
      screen.getByText(wdw.experience(BZ).name).closest('button')!.click()
    );
    expect(nav.goTo).toHaveBeenCalledWith(
      <Configure focus={{ kind: 'target', experienceId: BZ }} />
    );
  });

  // Roadmap item 13.
  describe('the park-morning check', () => {
    const rows = () =>
      within(screen.getByRole('list', { name: 'Before you start' }))
        .getAllByRole('listitem')
        .map(li => li.textContent);

    it('reads each signal while Autopilot is off on the day', () => {
      setup({ targets: [{ experienceId: BZ, autoBook: true }], dryRun: true });
      expect(rows()).toEqual([
        '✓Plan: 1 armed at Magic Kingdom',
        '!Dry run: on, so nothing will be booked',
        expect.stringMatching(/^[✓!]Sign-in: /),
      ]);
    });

    it('says when the plan here would only alert', () => {
      setup({ targets: [{ experienceId: BZ }] });
      expect(rows()[0]).toBe(
        '!Plan: none armed at Magic Kingdom, so it would only alert'
      );
    });

    it('goes once Autopilot is on', () => {
      setup({ enabled: true, status: { ...OFF, mode: 'idle', polls: 1 } });
      expect(
        screen.queryByRole('list', { name: 'Before you start' })
      ).not.toBeInTheDocument();
    });

    it('is not shown for another day', () => {
      setup({ bookingDate: TOMORROW });
      expect(
        screen.queryByRole('list', { name: 'Before you start' })
      ).not.toBeInTheDocument();
    });
  });

  // Roadmap item 14.
  describe('a plan saved at another park', () => {
    const epcotRide = { experienceId: '80010191', parkId: ep.id, date: TODAY };

    it('names it and offers to switch, never switching itself', () => {
      const { setPark } = setup({ targets: [epcotRide] });
      expect(
        screen.getByText(/this date’s plan is at EPCOT \(1\)/)
      ).toBeVisible();
      expect(setPark).not.toHaveBeenCalled();
      act(() =>
        screen.getByRole('button', { name: `Switch to ${ep.name}` }).click()
      );
      expect(setPark).toHaveBeenCalledWith(
        expect.objectContaining({ id: ep.id })
      );
    });

    it('says nothing when no plan is saved elsewhere', () => {
      setup();
      expect(screen.queryByText(/plan is at/)).not.toBeInTheDocument();
    });
  });

  it('says when a running Autopilot has nothing armed', () => {
    setup({
      enabled: true,
      status: { ...OFF, mode: 'idle', polls: 1 },
      targets: [{ experienceId: BZ }],
    });
    const notice = screen
      .getByText('Nothing is armed, so Autopilot will only alert.')
      .closest('div')!;
    act(() =>
      within(notice).getByRole('button', { name: 'Open Configure' }).click()
    );
    expect(nav.goTo.mock.calls[0]?.[0].type).toBe(Configure);
  });

  // Roadmap item 8's honesty half: it named the day's first drop for a date
  // the engine never bursts for.
  it('names no drop for a date other than today', () => {
    setup({ bookingDate: TOMORROW });
    expect(screen.queryByText('Next scheduled drop:')).not.toBeInTheDocument();
    expect(screen.getByText(/checks a later date steadily/)).toBeVisible();
  });

  it("tells the engine's time from the timetable's", () => {
    setup({
      enabled: true,
      status: {
        ...OFF,
        mode: 'approach',
        polls: 3,
        target: new ParkTime(9, 3),
        secondsToTarget: 180,
      },
    });
    expect(screen.getByText('Checking hard at:')).toBeVisible();
    expect(screen.getByText('Next scheduled drop:')).toBeVisible();
    expect(screen.queryByText('Next drop:')).not.toBeInTheDocument();
  });

  // The pre-trip list hid whenever the date was today, which is where a
  // first run opens.
  it('shows the pre-trip list on a first run, whatever the date', () => {
    setup();
    expect(
      screen.getByRole('region', { name: 'Pre-trip checklist' })
    ).toBeVisible();
  });

  it('keeps the pre-trip list for other days once there is a plan', () => {
    setup({ targets: [{ experienceId: BZ, autoBook: true }] });
    expect(
      screen.queryByRole('region', { name: 'Pre-trip checklist' })
    ).not.toBeInTheDocument();
  });

  it('asks for a backup when the last is more than a week old', () => {
    recordBackup(new Date(Date.now() - 9 * 86_400_000));
    setup({
      bookingDate: TOMORROW,
      targets: [{ experienceId: BZ, autoBook: true }],
    });
    expect(screen.getByText(/Last backup: 9 days ago/)).toBeVisible();
    act(() => screen.getByRole('button', { name: 'Back up' }).click());
    expect(nav.goTo).toHaveBeenCalledWith(<BackupRestore />);
  });

  it('does not ask again after a recent backup', () => {
    recordBackup(new Date());
    setup({
      bookingDate: TOMORROW,
      targets: [{ experienceId: BZ, autoBook: true }],
    });
    expect(screen.getByText(/Last backup: today/)).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Back up' })
    ).not.toBeInTheDocument();
  });

  it('offers a backup when nothing at all is saved', () => {
    setup();
    act(() => screen.getByRole('button', { name: 'Restore a backup' }).click());
    expect(nav.goTo).toHaveBeenCalledWith(<BackupRestore />);
  });

  // "Is it working?" was eight looks across two screens.
  it('says in one line why nothing has booked yet', () => {
    setup({
      enabled: true,
      status: { ...OFF, mode: 'idle', polls: 57 },
      skipCounts: { 'offer-outside-window': 12, 'partial-party': 2 },
    });
    expect(
      screen.getByText(
        'Nothing booked yet. Most often, the offered time was outside the window (12×).'
      )
    ).toBeVisible();
  });

  it('says when nothing it watches has come up', () => {
    setup({ enabled: true, status: { ...OFF, mode: 'idle', polls: 5 } });
    expect(
      screen.getByText(
        'Nothing booked yet, and nothing it watches has come up.'
      )
    ).toBeVisible();
  });

  it('says when nothing is held', () => {
    setup();
    expect(
      screen.getByText(/No Multi Pass reservations yet today/)
    ).toBeVisible();
  });

  it('summarises the plan in rank order, with what each target will do', () => {
    setup({
      watched: [BZ, DB],
      targets: [
        { experienceId: BZ, autoBook: true, rank: 2, after: new ParkTime(10) },
        { experienceId: DB, autoModify: true, paused: true, rank: 1 },
      ],
    });
    expect(screen.getByText(/1 armed, 1 paused/)).toBeVisible();
    const items = screen
      .getByRole('heading', { name: 'Watching (2)' })
      .parentElement!.querySelectorAll('li');
    expect(items[0]).toHaveTextContent(wdw.experience(DB).name);
    expect(items[0]).toHaveTextContent(/Paused · Auto-move · Rank 1/);
    expect(items[1]).toHaveTextContent(wdw.experience(BZ).name);
    expect(items[1]).toHaveTextContent(/Auto-book · from/);
    expect(items[1]).toHaveTextContent(/Rank 2/);
  });

  it('says when nothing is watched', () => {
    setup();
    expect(screen.getByText(/Nothing watched at Magic Kingdom/)).toBeVisible();
  });

  it('opens Configure, Plan check, Timeline and Activity', () => {
    setup();
    for (const label of ['Configure', 'Plan check', 'Timeline', 'Activity']) {
      fireEvent.click(screen.getByRole('button', { name: label }));
    }
    expect(nav.goTo.mock.calls.map(call => call[0].type)).toEqual([
      Configure,
      PlanCheck,
      Timeline,
      Activity,
    ]);
  });

  it('offers the way back to an interrupted NextLL search', () => {
    savePendingSearch({ experienceId: BZ, bookingDate: TODAY });
    const changeTab = jest.fn();
    renderScreen(
      <TabsContext
        value={{
          tabs: [],
          active: { name: 'Today', icon: null, component: () => null },
          changeTab,
          scrollPos: { get: () => 0, set: () => {} },
        }}
      >
        {today()}
      </TabsContext>
    );
    expect(screen.getByText(/Still looking for/)).toHaveTextContent(
      wdw.experience(BZ).name
    );
    fireEvent.click(screen.getByRole('button', { name: 'Open NextLL' }));
    expect(changeTab).toHaveBeenCalledWith('NextLL');
  });

  it('says nothing about NextLL when no search was interrupted', () => {
    setup();
    expect(screen.queryByText(/Still looking for/)).not.toBeInTheDocument();
  });
});

describe('Today refusal warning', () => {
  const refusing = {
    eligibility: { count: 5, since: new ParkTime(8, 55) },
  };

  // A refusal lands on eligibility, one step before an offer exists, so
  // autopilot keeps polling, alerting and learning drops while never acting.
  // Without this the screen reads as perfectly healthy.
  it('says so when Disney is refusing requests', () => {
    setup({
      status: { mode: 'idle', consecutiveFailures: 0, polls: 40 },
      refusals: refusing,
    });
    expect(screen.getByText(/Disney is refusing these requests/)).toBeVisible();
    expect(screen.getByText(/checking who is eligible/)).toBeVisible();
  });

  // Off, this describes earlier today rather than why nothing is happening.
  it('says nothing while switched off', () => {
    setup({ refusals: refusing });
    expect(
      screen.queryByText(/Disney is refusing these requests/)
    ).not.toBeInTheDocument();
  });

  it('says nothing when requests are going through', () => {
    setup({ status: { mode: 'idle', consecutiveFailures: 0, polls: 40 } });
    expect(
      screen.queryByText(/Disney is refusing these requests/)
    ).not.toBeInTheDocument();
  });
});

// `mode` reports the cadence the policy asked for, not the exponential
// backoff the poller is actually waiting out, so a failing Autopilot looked
// exactly like an idle one -- just slower.
describe('Today backoff', () => {
  const failing = (consecutiveFailures: number) => ({
    status: {
      mode: 'idle' as const,
      consecutiveFailures,
      polls: 12,
      lastError: 'Request failed',
    },
    enabled: true,
  });

  it('says it is backing off before it has given up', () => {
    setup(failing(3));
    expect(screen.getByText(/3 failed checks in a row/)).toBeVisible();
    expect(screen.getByText(/Request failed/)).toBeVisible();
  });

  it('says nothing while checks are succeeding', () => {
    setup({ ...failing(0), status: { ...failing(0).status } });
    expect(screen.queryByText(/failed check/)).not.toBeInTheDocument();
  });

  it('counts one failure in the singular', () => {
    setup(failing(1));
    expect(screen.getByText(/1 failed check in a row/)).toBeVisible();
  });

  // Once it has stopped, the red notice says so and this would be noise.
  it('defers to the stopped notice', () => {
    setup({
      enabled: true,
      status: {
        mode: 'stopped',
        consecutiveFailures: 8,
        polls: 20,
        lastError: 'Request failed',
      },
    });
    expect(screen.getByText(/Stopped after 8 failed checks/)).toBeVisible();
    expect(screen.queryByText(/in a row/)).not.toBeInTheDocument();
  });
});

/**
 * The alert channel, which on iOS Safari is the only one there is.
 *
 * `Notification` is undefined outside an installed web app and vibration is
 * unimplemented, so a context that never unlocked -- or that iOS interrupted
 * -- leaves a run unable to reach anybody, silently. Found on a phone: a ride
 * came up, autopilot alerted, and nothing made a sound.
 */
describe('Today alert sound', () => {
  type AudioGlobal = Omit<typeof globalThis, 'AudioContext'> & {
    AudioContext?: unknown;
  };
  const g = globalThis as AudioGlobal;

  function fakeAudio(state: string) {
    const listeners = new Set<() => void>();
    const ctx = {
      state,
      currentTime: 0,
      resume: jest.fn(async () => {
        await Promise.resolve();
        ctx.setState('running');
      }),
      createOscillator: jest.fn(() => ({
        type: '',
        frequency: { value: 0 },
        connect: jest.fn(() => gain),
        start: jest.fn(),
        stop: jest.fn(),
      })),
      createGain: jest.fn(() => gain),
      sampleRate: 48_000,
      createBuffer: jest.fn(() => ({})),
      createBufferSource: jest.fn(() => ({
        buffer: undefined as unknown,
        connect: jest.fn(),
        start: jest.fn(),
      })),
      destination: {},
      addEventListener: jest.fn((type: string, listener: () => void) => {
        if (type === 'statechange') listeners.add(listener);
      }),
      removeEventListener: jest.fn((type: string, listener: () => void) => {
        if (type === 'statechange') listeners.delete(listener);
      }),
      setState(next: string) {
        this.state = next;
        for (const listener of listeners) listener();
      },
    };
    const gain = {
      gain: {
        setValueAtTime: jest.fn(),
        linearRampToValueAtTime: jest.fn(),
      },
      connect: jest.fn(() => ({})),
    };
    g.AudioContext = jest.fn(() => ctx);
    return ctx;
  }

  beforeEach(() => resetAudioForTests());
  afterEach(() => {
    resetAudioForTests();
    delete g.AudioContext;
  });

  // Offering a sound test on a browser that cannot make one is a row that can
  // only ever report failure.
  it('says nothing where the browser has no audio at all', () => {
    setup({ enabled: true });
    expect(screen.queryByText('Test sound')).not.toBeInTheDocument();
  });

  it('warns while sound would be silent', () => {
    fakeAudio('suspended');
    setup({ enabled: true });
    expect(screen.getByText(/Alert sound is not armed/)).toBeVisible();
  });

  it('keeps the pre-flight sound check neutral while autopilot is off', () => {
    fakeAudio('suspended');
    setup({ enabled: false });
    const status = screen.getByText(
      'Test alert sound before starting Autopilot.'
    );
    expect(status).toBeVisible();
    expect(status).toHaveClass('text-gray-600');
    expect(status).not.toHaveClass('text-red-700');
  });

  it('warns whenever autopilot is enabled, including after it stops', () => {
    fakeAudio('suspended');
    setup({
      enabled: true,
      status: {
        mode: 'stopped',
        consecutiveFailures: 8,
        polls: 20,
        lastError: 'Request failed',
      },
    });
    expect(screen.getByText(/Alert sound is not armed/)).toHaveClass(
      'text-red-700'
    );
  });

  it('wakes the sound up on demand and says so', async () => {
    const ctx = fakeAudio('suspended');
    setup({ enabled: true });
    await act(async () => {
      screen.getByText('Test sound').click();
    });
    expect(ctx.resume).toHaveBeenCalled();
    // Actually played, not merely woken: the point of the button is hearing it.
    expect(ctx.createOscillator).toHaveBeenCalled();
    expect(screen.getByText('Alert sound is armed.')).toBeVisible();
  });

  it('reports a context that refuses to wake, rather than claiming success', async () => {
    const ctx = fakeAudio('suspended');
    ctx.resume = jest.fn(async () => {
      throw new Error('gesture required');
    });
    setup({ enabled: true });
    await act(async () => {
      screen.getByText('Test sound').click();
    });
    expect(screen.getByText(/Alert sound is not armed/)).toBeVisible();
  });

  it('reports an interruption immediately rather than waiting for a poll', () => {
    const ctx = fakeAudio('running');
    primeAudio();
    setup({ enabled: true });
    expect(screen.getByText('Alert sound is armed.')).toBeVisible();

    act(() => ctx.setState('interrupted'));

    expect(screen.getByText(/Alert sound is not armed/)).toBeVisible();
  });
});

describe('Today screen wake status', () => {
  const OWNER = Symbol('today-wake-test');

  function installWakeLock() {
    const listeners = new Set<() => void>();
    const sentinel = {
      release: jest.fn(async () => undefined),
      addEventListener: jest.fn((type: string, listener: () => void) => {
        if (type === 'release') listeners.add(listener);
      }),
      dropFromBrowser() {
        for (const listener of listeners) listener();
      },
    };
    Object.defineProperty(navigator, 'wakeLock', {
      configurable: true,
      value: { request: jest.fn(async () => sentinel) },
    });
    return sentinel;
  }

  afterEach(async () => {
    await releaseScreenAwake(OWNER);
    Reflect.deleteProperty(navigator, 'wakeLock');
  });

  it('omits the row when the browser has no wake-lock API', () => {
    setup({ enabled: true });
    expect(screen.queryByText(/Screen may sleep/)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Screen is being kept awake/)
    ).not.toBeInTheDocument();
  });

  it('warns when screen wake is supported but idle', () => {
    installWakeLock();
    setup({ enabled: true });
    expect(screen.getByText(/Screen may sleep/)).toBeVisible();
  });

  it('omits an idle wake-lock warning while autopilot is off', () => {
    installWakeLock();
    setup({ enabled: false });
    expect(screen.queryByText(/Screen may sleep/)).not.toBeInTheDocument();
  });

  it('shows a held lock and reacts when the browser releases it', async () => {
    const sentinel = installWakeLock();
    await holdScreenAwake(OWNER);
    setup({ enabled: true });
    expect(screen.getByText('Screen is being kept awake.')).toBeVisible();

    act(() => sentinel.dropFromBrowser());

    expect(screen.getByText(/Screen may sleep/)).toBeVisible();
  });
});

describe('Today context strip', () => {
  it('names the park, the day and the party under the title', () => {
    localStorage.setItem(PARTY_IDS_KEY, JSON.stringify(['a', 'b']));
    setup();
    const strip = screen.getByText('Party of 2').parentElement!;
    expect(within(strip).getByText('Magic Kingdom')).toBeInTheDocument();
    expect(within(strip).getByText('Today')).toBeInTheDocument();
  });
});
