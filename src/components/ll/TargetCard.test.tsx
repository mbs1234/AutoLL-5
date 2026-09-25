import { fireEvent, render, screen, within } from '@testing-library/react';
import { use } from 'react';

import { mk, wdw } from '@/__fixtures__/resort';
import { Experience } from '@/api/ll';
import { WatchTarget } from '@/autopilot/watchlist';
import AutopilotContext from '@/contexts/AutopilotContext';
import { ParkTime } from '@/datetime';

import TargetCard from './TargetCard';

const BZ = '80010114';
const NAME = wdw.experience(BZ).name;

function experience(tier?: number): Experience {
  return {
    ...wdw.experience(BZ),
    park: mk,
    tier,
    standby: { available: true, waitTime: 30 },
    flex: { available: true, nextAvailableTime: new ParkTime(11) },
  } as Experience;
}

const handlers = {
  toggleAutoBook: jest.fn(),
  toggleAutoModify: jest.fn(),
  toggleBookThenMove: jest.fn(),
  togglePaused: jest.fn(),
  toggleAutoSwap: jest.fn(),
  togglePasskey: jest.fn(),
  setTargetWindow: jest.fn(),
  setTargetRank: jest.fn(),
};

/** The default context, with the handlers under test swapped in. */
function Handlers({ children }: { children: React.ReactNode }) {
  const state = use(AutopilotContext);
  return (
    <AutopilotContext value={{ ...state, ...handlers }}>
      {children}
    </AutopilotContext>
  );
}

function setup(target: Partial<WatchTarget> = {}, tier?: number) {
  const onRemove = jest.fn();
  const { unmount } = render(
    <Handlers>
      <TargetCard
        experience={experience(tier)}
        target={{ experienceId: BZ, ...target }}
        onRemove={onRemove}
      />
    </Handlers>
  );
  return {
    onRemove,
    unmount,
    summary: screen.getByText(NAME).closest('summary')!,
  };
}

beforeEach(() => jest.clearAllMocks());

describe('TargetCard', () => {
  it('folds to one line that says what will happen', () => {
    const { summary } = setup({
      autoBook: true,
      rank: 1,
      passkey: true,
      after: new ParkTime(10),
      before: new ParkTime(14),
    });
    const line = within(summary);
    expect(line.getByText(/Auto-book/)).toBeInTheDocument();
    expect(line.getByText(/Rank 1/)).toBeInTheDocument();
    expect(line.getByText(/Passkey/)).toBeInTheDocument();
    expect(summary.querySelector('time[datetime="10:00:00"]')).not.toBeNull();
    expect(summary.querySelector('time[datetime="14:00:00"]')).not.toBeNull();
    expect(line.queryByRole('button')).not.toBeInTheDocument();
  });

  // Its arrow sat still while the other fold-outs turned theirs.
  it('turns its arrow when it opens', () => {
    const { summary } = setup();
    expect(summary.closest('details')).toHaveClass('group');
    expect(summary.querySelector('[aria-hidden]')).toHaveClass(
      'group-open:rotate-90'
    );
  });

  it('says watch only, and says paused ahead of the mode', () => {
    const { summary, unmount } = setup();
    expect(within(summary).getByText(/Watch only/)).toBeInTheDocument();
    unmount();
    const paused = setup({ autoBook: true, paused: true }).summary;
    expect(within(paused).getByText('Paused')).toBeInTheDocument();
    expect(within(paused).getByText(/Auto-book/)).toBeInTheDocument();
  });

  it('opens to the controls, which call back with the id', () => {
    setup();
    fireEvent.click(
      screen.getByRole('radio', { name: `Auto-book for ${NAME}` })
    );
    expect(handlers.toggleAutoBook).toHaveBeenCalledWith(BZ);
    screen.getByTitle(`Pause ${NAME}`).click();
    expect(handlers.togglePaused).toHaveBeenCalledWith(BZ);
    fireEvent.change(
      screen.getByLabelText(`Earliest return time for ${NAME}`),
      {
        target: { value: '15:30' },
      }
    );
    expect(handlers.setTargetWindow).toHaveBeenCalledWith(BZ, 'after', '15:30');
    fireEvent.change(screen.getByLabelText(`Plan rank for ${NAME}`), {
      target: { value: '2' },
    });
    expect(handlers.setTargetRank).toHaveBeenCalledWith(BZ, 2);
  });

  // Every keystroke used to reach the watch list the poller reads, so
  // backspacing over "12" made the target rank 1 for a render, and clearing
  // the field to retype deleted the rank outright. A burst tick is 1.2s.
  describe('the plan rank field', () => {
    const rank = () => screen.getByLabelText(`Plan rank for ${NAME}`);

    it('commits a complete value', () => {
      setup({ rank: 12 });
      fireEvent.change(rank(), { target: { value: '2' } });
      expect(handlers.setTargetRank).toHaveBeenCalledWith(BZ, 2);
    });

    it('does not clear the rank while the field is empty', () => {
      setup({ rank: 12 });
      fireEvent.change(rank(), { target: { value: '' } });
      expect(handlers.setTargetRank).not.toHaveBeenCalled();
      expect(rank()).toHaveValue(null);
    });

    it('clears it when the field is left empty', () => {
      setup({ rank: 12 });
      fireEvent.change(rank(), { target: { value: '' } });
      fireEvent.blur(rank());
      expect(handlers.setTargetRank).toHaveBeenCalledWith(BZ, undefined);
    });

    // `min={1}` is a spinner hint, not a constraint, and a rank of 0 or -5
    // outranks everything armed.
    it('refuses a rank below one', () => {
      setup({ rank: 12 });
      fireEvent.change(rank(), { target: { value: '0' } });
      expect(handlers.setTargetRank).not.toHaveBeenCalled();
    });

    it('shows what was typed while it is uncommitted', () => {
      setup({ rank: 12 });
      fireEvent.change(rank(), { target: { value: '0' } });
      expect(rank()).toHaveValue(0);
    });
  });

  // Adding a ride used to arm nothing, silently.
  it('says a just-added ride will only alert until a choice is made', () => {
    render(
      <Handlers>
        <TargetCard
          experience={experience()}
          target={{ experienceId: BZ }}
          defaultOpen
          justAdded
          onRemove={() => {}}
        />
      </Handlers>
    );
    expect(
      screen.getByText(/Just added. It will only alert until you choose/)
    ).toBeVisible();
  });

  it('says nothing more once a choice is made', () => {
    render(
      <Handlers>
        <TargetCard
          experience={experience()}
          target={{ experienceId: BZ, autoBook: true }}
          defaultOpen
          justAdded
          onRemove={() => {}}
        />
      </Handlers>
    );
    expect(screen.queryByText(/Just added/)).not.toBeInTheDocument();
  });

  // Swap in gave no sign of what it would give up, and Configure's help
  // called that the "lowest-priority" pass, which reads as your own rank.
  it('says what a swap would do with the passes held now', () => {
    setup({ autoSwap: true });
    expect(
      screen.getByText('With a slot free it books instead of swapping.')
    ).toBeInTheDocument();
  });

  it('shows the state each control is in', () => {
    setup({ autoModify: true, autoSwap: true });
    expect(
      screen.getByRole('radio', { name: `Auto-move for ${NAME}` })
    ).toBeChecked();
    expect(screen.getByTitle(`Stop swapping in ${NAME}`)).toHaveTextContent(
      'Swap in on'
    );
    expect(
      screen.getByRole('radio', { name: `Auto-book for ${NAME}` })
    ).not.toBeChecked();
  });

  it('offers a passkey only where one is possible', () => {
    const { unmount } = setup({}, undefined);
    expect(screen.getByTitle(`Use ${NAME} as a passkey`)).toBeInTheDocument();
    unmount();
    setup({}, 1);
    expect(screen.queryByTitle(/passkey/)).not.toBeInTheDocument();
  });

  it('keeps removal inside the body, as a tap you have to open for', () => {
    const { onRemove, summary } = setup();
    expect(
      within(summary).queryByTitle(`Stop watching ${NAME}`)
    ).not.toBeInTheDocument();
    screen.getByTitle(`Stop watching ${NAME}`).click();
    expect(onRemove).toHaveBeenCalledTimes(1);
  });
});

/**
 * The window is written into the watch list the running poller reads, so an
 * in-progress edit must not reach it. Clearing a bound to retype it used to
 * remove the bound immediately, and a drop landing in that gap was booked at a
 * time the user had explicitly excluded.
 */
describe('TargetCard return-time window editing', () => {
  const earliest = () =>
    screen.getByLabelText(`Earliest return time for ${NAME}`);

  it('commits a complete time straight away', () => {
    setup({ after: new ParkTime(15) });
    fireEvent.change(earliest(), { target: { value: '14:00' } });
    expect(handlers.setTargetWindow).toHaveBeenCalledWith(BZ, 'after', '14:00');
  });

  it('does not clear the bound while the field is empty mid-edit', () => {
    setup({ after: new ParkTime(15) });
    fireEvent.change(earliest(), { target: { value: '' } });
    expect(handlers.setTargetWindow).not.toHaveBeenCalled();
    // The field shows empty so the user can type, while the target keeps 15:00.
    expect(earliest()).toHaveValue('');
  });

  it('commits the replacement typed after clearing, and never the gap', () => {
    setup({ after: new ParkTime(15) });
    fireEvent.change(earliest(), { target: { value: '' } });
    fireEvent.change(earliest(), { target: { value: '14:00' } });
    expect(handlers.setTargetWindow).toHaveBeenCalledTimes(1);
    expect(handlers.setTargetWindow).toHaveBeenCalledWith(BZ, 'after', '14:00');
  });

  // Clearing a bound and leaving is still how you say "no bound".
  it('clears the bound once the emptied field is left', () => {
    setup({ after: new ParkTime(15) });
    fireEvent.change(earliest(), { target: { value: '' } });
    fireEvent.blur(earliest());
    expect(handlers.setTargetWindow).toHaveBeenCalledWith(BZ, 'after', '');
  });

  it('does not commit on blur when nothing was cleared', () => {
    setup({ after: new ParkTime(15) });
    fireEvent.blur(earliest());
    expect(handlers.setTargetWindow).not.toHaveBeenCalled();
  });

  it('treats the latest bound the same way', () => {
    setup({ before: new ParkTime(19) });
    const latest = screen.getByLabelText(`Latest return time for ${NAME}`);
    fireEvent.change(latest, { target: { value: '' } });
    expect(handlers.setTargetWindow).not.toHaveBeenCalled();
    fireEvent.blur(latest);
    expect(handlers.setTargetWindow).toHaveBeenCalledWith(BZ, 'before', '');
  });
});
