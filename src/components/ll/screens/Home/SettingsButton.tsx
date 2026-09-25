import { use, useId, useMemo, useRef, useState } from 'react';

import { authStore } from '@/api/auth';
import { APP_NAME, BUILD_REV } from '@/appIdentity';
import { describeLastBackup, lastBackupAt } from '@/autopilot/backup';
import Button from '@/components/Button';
import Overlay from '@/components/Overlay';
import NavContext from '@/contexts/NavContext';
// import NewsIcon from '@/icons/NewsIcon';
import BackupIcon from '@/icons/BackupIcon';
// import News from '@/components/screens/News';

import ExitIcon from '@/icons/ExitIcon';
import SettingsIcon from '@/icons/SettingsIcon';
import UserIcon from '@/icons/UserIcon';

import BackupRestore from '../BackupRestore';
import PartySelector from '../PartySelector';

export default function SettingsButton() {
  const { goTo } = use(NavContext);
  const sessionStatus = authStore.getStatus();
  const [sessionOnly, setSessionOnly] = useState(
    () => authStore.getPersistence() === 'session'
  );
  // Log Out used to act on the one tap. It stops Autopilot and any search,
  // and signing back in can need Disney's emailed code, so it asks first.
  const [confirmingLogout, confirmLogout] = useState(false);
  const logoutTitleId = useId();
  const options = useMemo(
    () => [
      {
        text: 'Party Selection',
        icon: <UserIcon />,
        action: () => goTo(<PartySelector />),
      },
      {
        text: 'Backup and Restore',
        icon: <BackupIcon />,
        action: () => goTo(<BackupRestore />),
      },
      {
        text: 'Log Out',
        icon: <ExitIcon />,
        action: () => confirmLogout(true),
      },
      {
        text: `Session-only login: ${sessionOnly ? 'On' : 'Off'}`,
        icon: <UserIcon />,
        action: () => {
          const next = !sessionOnly;
          authStore.setPersistence(next ? 'session' : 'persistent');
          setSessionOnly(next);
        },
      },
      // {
      //   text: 'BG1 News',
      //   icon: <NewsIcon />,
      //   action: () => goTo(<News />),
      // },
    ],
    [goTo, sessionOnly]
  );
  const [showingMenu, showMenu] = useState(false);
  const listRef = useRef<HTMLUListElement>(null);

  return (
    <>
      <button
        className="min-w-11 self-stretch px-2.5 py-2"
        onClick={() => showMenu(true)}
        title="Settings Menu"
      >
        <SettingsIcon />
      </button>
      {showingMenu && (
        <Overlay
          onClick={event => {
            if (!listRef.current?.contains(event.target as Element)) {
              showMenu(false);
            }
          }}
          data-testid="shade"
        >
          <ul
            className="dividers overflow-auto min-w-[50%] max-h-[90%] rounded-lg bg-white text-black text-lg font-normal"
            ref={listRef}
          >
            {options.map(opt => {
              return (
                // The row's padding on the button, not the item, so the whole
                // row answers a tap rather than its middle.
                <li key={opt.text} className="py-0!">
                  <button
                    className="flex items-center w-full px-4 py-3"
                    onClick={() => {
                      showMenu(false);
                      setTimeout(opt.action, 50);
                    }}
                  >
                    <span className="mr-2.5 text-gray-700" aria-hidden>
                      {opt.icon}
                    </span>
                    {opt.text}
                  </button>
                </li>
              );
            })}
            <li
              className="px-4 text-center text-sm text-gray-500"
              aria-label="Session status"
            >
              Session: {sessionStatus.replaceAll('-', ' ')}
              <span className="block text-xs">
                Session-only login forgets your sign-in when this tab closes.
              </span>
            </li>
            {/* Read each time the menu opens, so it is current without anything
                having to notify it. Here rather than on Today, which is for the
                park day; a reminder to back up belongs with the backup. */}
            <li
              className="px-4 text-center text-sm text-gray-500"
              aria-label="Last backup"
            >
              Last backup: {describeLastBackup(lastBackupAt())}
            </li>
            {/* Which build this is. More than one bg1-derived build can be
                installed on the same phone; this used to sit in the tab bar,
                where five tabs no longer leave it room. */}
            <li
              className="px-4 text-center text-sm text-gray-500"
              aria-label={`Build: ${APP_NAME} ${BUILD_REV}`}
            >
              {APP_NAME} · {BUILD_REV}
            </li>
          </ul>
        </Overlay>
      )}
      {confirmingLogout && (
        <Overlay>
          <div
            role="alertdialog"
            aria-labelledby={logoutTitleId}
            className="max-w-sm rounded-lg bg-white p-4 text-black"
          >
            <h3 id={logoutTitleId} className="mt-0 font-semibold">
              Log out of Disney?
            </h3>
            <p className="mt-2 mb-0">
              Autopilot and any search stop, and signing back in may need the
              code Disney emails you.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button onClick={() => confirmLogout(false)}>
                Stay signed in
              </Button>
              <Button
                color="bg-red-700 text-white"
                border="border border-transparent"
                onClick={() => {
                  confirmLogout(false);
                  authStore.deleteData();
                }}
              >
                Log out
              </Button>
            </div>
          </div>
        </Overlay>
      )}
    </>
  );
}
