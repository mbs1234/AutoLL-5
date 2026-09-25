import { use } from 'react';

import ThemeContext, { Theme } from '@/contexts/ThemeContext';

import HeaderBar from './HeaderBar';

export interface ScreenProps {
  title: React.ReactNode;
  children: React.ReactNode;
  buttons?: React.ReactNode;
  subhead?: React.ReactNode;
  footer?: React.ReactNode;
  theme?: Theme;
  ref?: React.RefObject<HTMLDivElement | null>;
}

export interface ScreenRef {
  scroll: (x: number, y: number) => void;
}

export default function Screen({
  title,
  buttons,
  subhead,
  footer,
  theme,
  children,
  ref,
}: ScreenProps) {
  theme ??= use(ThemeContext);

  // The park's colour reaches the accent utilities through this variable, so
  // the chip and the selected tab follow the park without a class per park.
  // Skipped when a theme has no colour to give, and the accent falls back.
  const accent = theme.color
    ? ({ '--accent': theme.color } as React.CSSProperties)
    : undefined;

  return (
    <ThemeContext value={theme}>
      <div className="fixed inset-0 flex flex-col bg-paper" style={accent}>
        <HeaderBar title={title} buttons={buttons} subhead={subhead} />
        <div ref={ref} className="relative flex-1 overflow-auto px-3 pb-5">
          {children}
        </div>
        {footer && (
          <div className="relative border-t border-gray-300 bg-white font-semibold text-gray-600">
            {footer}
          </div>
        )}
      </div>
    </ThemeContext>
  );
}
