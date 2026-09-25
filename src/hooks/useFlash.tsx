import { useCallback, useEffect, useState } from 'react';

import Flash, { FlashType } from '@/components/Flash';
import { DateTime, formatTime } from '@/datetime';

const DEFAULT_DURATION_MS = 3000;

export default function useFlash(): [React.ReactNode, typeof flash] {
  const [message, setMessage] = useState('');
  const [type, setType] = useState<FlashType>('alert');
  const [at, setAt] = useState('');

  // An alert fades. An error stays until it is dismissed or replaced: three
  // seconds was often the only record there was of what went wrong, and the
  // guide's one diagnostic is reading it.
  useEffect(() => {
    if (message === '' || type === 'error') return;
    const timeoutId = self.setTimeout(() => {
      setMessage('');
    }, DEFAULT_DURATION_MS);
    return () => clearTimeout(timeoutId);
  }, [message, type]);

  const flash = useCallback((message: string, type?: FlashType) => {
    setMessage(message);
    setType(type || 'alert');
    setAt(message ? formatTime(DateTime.now().time) : '');
  }, []);
  const flashElem = message ? (
    type === 'error' ? (
      <Flash
        message={message}
        type={type}
        at={at}
        onDismiss={() => setMessage('')}
      />
    ) : (
      <Flash message={message} type={type} />
    )
  ) : null;
  return [flashElem, flash];
}
