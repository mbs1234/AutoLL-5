import Flash from '@/components/Flash';
import { act, click, render, screen, see } from '@/testing';

import useFlash from './useFlash';

jest.useFakeTimers();

describe('Flash', () => {
  it('shows alert message', () => {
    render(<Flash message="hi" type="alert" />);
    expect(screen.getByRole('alert')).toHaveClass('bg-yellow-200');
    expect(screen.getByRole('alert')).toHaveTextContent('hi');
  });

  it('shows error message', () => {
    render(<Flash message="oops" type="error" />);
    expect(screen.getByRole('alert')).toHaveClass('bg-red-200');
    expect(screen.getByRole('alert')).toHaveTextContent('oops');
  });

  it('renders null when no message', () => {
    const { container } = render(<Flash message="" type="alert" />);
    expect(container).toBeEmptyDOMElement();
  });
});

function UseFlashExample() {
  const [flashElem, flash] = useFlash();
  return (
    <div>
      {flashElem}
      <button onClick={() => flash('hi')}>Alert</button>
      <button onClick={() => flash('oops', 'error')}>Error</button>
    </div>
  );
}

describe('useFlash()', () => {
  it('flashes an alert that fades', async () => {
    render(<UseFlashExample />);
    see.no('hi');

    click('Alert');
    expect(screen.getByRole('alert')).toHaveClass('bg-yellow-200');
    expect(screen.getByRole('alert')).toHaveTextContent('hi');
    act(() => {
      jest.runOnlyPendingTimers();
    });
    see.no('hi');
  });

  // Three seconds was often the only record there was of what went wrong.
  it('keeps an error, with its time, until it is dismissed', async () => {
    render(<UseFlashExample />);
    click('Error');
    const alert = screen.getByRole('alert');
    expect(alert).toHaveClass('bg-red-200');
    expect(alert).toHaveTextContent(/\d:\d\d [AP]M — oops/);
    act(() => {
      jest.advanceTimersByTime(60_000);
    });
    expect(screen.getByRole('alert')).toHaveTextContent('oops');
    click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('lets a new message replace an error', async () => {
    render(<UseFlashExample />);
    click('Error');
    click('Alert');
    expect(screen.getByRole('alert')).toHaveTextContent('hi');
    expect(screen.getByRole('alert')).not.toHaveTextContent('oops');
  });
});
