import { AuthData, ReauthNeeded, authStore } from '@/api/auth';
import { APP_NAME, PAGES_BASE } from '@/appIdentity';
import { markRunning } from '@/autopilot/running';
import { DISCLAIMER_ACCEPTED_KEY } from '@/hooks/useDisclaimer';
import { NEWS_VERSION_KEY } from '@/hooks/useNews';
import kvdb from '@/kvdb';
import { navigate } from '@/navigate';
import { act, click, render, screen, see, waitFor } from '@/testing';

import App, { NEWS_VERSION } from './App';
import Screen from './Screen';
import { SIGN_IN_STOP_KEY } from './ll/signInStop';

jest.mock('@/fetch');
jest.mock('@/navigate');
jest.mock('./ll/Merlock', () => {
  return function Merlock() {
    return <Screen title="LL">test</Screen>;
  };
});
jest.mock('./LoginForm', () => {
  function LoginForm({ onLogin }: { onLogin: (data: AuthData) => void }) {
    const onClick = () =>
      onLogin({
        swid: '{MINNIE}',
        accessToken: 'm1nn13',
        expires: new Date(2121, 12, 21, 12, 21, 12).getTime(),
        resortId: 'WDW',
        version: 1,
        receivedAt: Date.now(),
      });
    return <button onClick={onClick}>Log In</button>;
  }
  return LoginForm;
});
jest.spyOn(authStore, 'getData').mockReturnValue({ accessToken: '', swid: '' });

function renderComponent() {
  render(<App />);
}

describe('App', () => {
  beforeEach(() => {
    self.origin = 'https://disneyworld.disney.go.com';
    jest.clearAllMocks();
    kvdb.set(DISCLAIMER_ACCEPTED_KEY, 1);
    kvdb.set(NEWS_VERSION_KEY, 1);
  });

  it('shows Disclaimer if not yet accepted', async () => {
    kvdb.delete(DISCLAIMER_ACCEPTED_KEY);
    renderComponent();
    await see.screen('Warning!');
    click('Accept');
    expect(kvdb.get(DISCLAIMER_ACCEPTED_KEY)).toBe(1);
  });

  it('shows News if newer than last seen', async () => {
    kvdb.set(NEWS_VERSION_KEY, -1);
    renderComponent();
    await see.screen(`${APP_NAME} News`);
    click('Close');
    expect(kvdb.get(NEWS_VERSION_KEY)).toBe(NEWS_VERSION);
  });

  it('loads client if auth data valid', async () => {
    renderComponent();
    await see.screen('LL');
  });

  it('shows LoginForm if auth data expired', async () => {
    jest.mocked(authStore.getData).mockImplementationOnce(() => {
      throw new ReauthNeeded();
    });
    jest.spyOn(authStore, 'setData');
    renderComponent();
    click(await screen.findByRole('button', { name: 'Log In' }));
    expect(authStore.setData).toHaveBeenLastCalledWith({
      swid: '{MINNIE}',
      accessToken: 'm1nn13',
      expires: new Date(2121, 12, 21, 12, 21, 12).getTime(),
      resortId: 'WDW',
      version: 1,
      receivedAt: expect.any(Number),
    });
    await see.screen('LL');
  });

  it('shows LoginForm if client.onAuthorized() called', async () => {
    renderComponent();
    await see.screen('LL');
    act(() => authStore.onUnauthorized());
    see('Log In');
  });

  // The sign-in screen replaces the app, so a running Autopilot stops with it
  // and comes back off. The moment is noted for Today to report.
  it('notes when an expiry stops a running engine', async () => {
    kvdb.delete(SIGN_IN_STOP_KEY);
    renderComponent();
    await see.screen('LL');
    const release = markRunning();
    act(() => authStore.onUnauthorized());
    release();
    expect(kvdb.get(SIGN_IN_STOP_KEY)).toEqual(expect.any(Number));
  });

  it('notes nothing when no engine was running', async () => {
    kvdb.delete(SIGN_IN_STOP_KEY);
    renderComponent();
    await see.screen('LL');
    act(() => authStore.onUnauthorized());
    expect(kvdb.get(SIGN_IN_STOP_KEY)).toBeUndefined();
  });

  it('sends a Disneyland page to the start page, like any other', async () => {
    self.origin = 'https://disneyland.disney.go.com';
    renderComponent();
    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith(`${PAGES_BASE}/start.html`);
    });
  });

  it(`redirects to start page if ${APP_NAME} cannot run from this origin`, async () => {
    self.origin = 'https://example.com';
    renderComponent();
    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith(`${PAGES_BASE}/start.html`);
    });
  });
});
