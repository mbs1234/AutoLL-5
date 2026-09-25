import { use } from 'react';

import NavContext, { NavError } from '@/contexts/NavContext';

const TYPES = {
  normal: 'min-h-10 px-3 py-1.5 rounded-xl font-semibold',
  // 32 px to see, 44 px to tap: the after-element reaches 7 px above and
  // below the padding box -- 6 px past the 1 px border -- into the gap around
  // the chip. Test sound, Take it, Undo and every action chip are this size.
  small:
    'relative min-h-8 px-3 py-1 rounded-full text-[13px] font-semibold after:absolute after:inset-x-0 after:-inset-y-[7px]',
  full: 'w-full min-h-13 px-4 py-3 rounded-2xl text-[17px] font-bold',
};

/**
 * What a button looks like when its caller does not say.
 *
 * Quiet by default: white with a hairline, so the colours left on a screen are
 * the ones that mean something -- green for go, red for stop, the park's own
 * colour for where you are. The one exception is the full-width button, which
 * is a screen's main action and is drawn in ink. A caller that passes `color`
 * or `border` replaces these outright, exactly as before.
 */
const COLORS = {
  normal: 'bg-white text-ink',
  small: 'bg-white text-ink',
  full: 'bg-ink text-white',
};

const BORDERS = {
  normal: 'border border-gray-300',
  small: 'border border-gray-300',
  full: 'border border-transparent',
};

export default function Button<P>(
  props: Omit<React.HTMLProps<HTMLButtonElement>, 'type' | 'onClick'> & {
    onClick?: () => void | Promise<void>;
    type?: keyof typeof TYPES;
    back?: boolean | { screen?: React.FC<P>; props?: Partial<P> };
    color?: string;
    border?: string;
  }
) {
  const { goBack } = use(NavContext);
  const { type, back, onClick, className, color, border, ...attrs } = props;
  const kind = type || 'normal';
  const cls = `${TYPES[kind]} ${className || ''} ${color ?? COLORS[kind]} ${border ?? BORDERS[kind]}`;
  return (
    <button
      onClick={async event => {
        event.stopPropagation();
        if (back) {
          try {
            await goBack(back === true ? undefined : back);
          } catch (error) {
            if (!(error instanceof NavError)) throw error;
          }
        }
        if (onClick) await onClick();
      }}
      className={`${cls} inline-flex items-center justify-center min-w-9 disabled:opacity-50`}
      {...attrs}
    />
  );
}
