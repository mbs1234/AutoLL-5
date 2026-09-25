import { Children, Fragment, isValidElement } from 'react';

import useScreenState from '@/hooks/useScreenState';
import BackIcon from '@/icons/BackIcon';

import Button from './Button';

export default function HeaderBar({
  title,
  buttons,
  subhead,
}: {
  title: React.ReactNode;
  buttons?: React.ReactNode;
  subhead?: React.ReactNode;
}) {
  const { isFirstScreen } = useScreenState();

  function changeButtonColors(node: React.ReactNode): React.ReactNode {
    if (!isValidElement(node) || typeof node.type === 'string') return node;
    const n = node as React.JSX.Element;
    return n.type === Fragment ? (
      Children.map(n.props.children, changeButtonColors)
    ) : (
      <n.type
        {...n.props}
        color="bg-white text-ink"
        // Tighter than a button in the page: the LL tab carries five of these
        // beside its title, and they have to fit on one row at 390 px.
        className={`px-1.5! ${n.props.className ?? ''}`}
      />
    );
  }

  return (
    <div className="px-3 pt-2 pb-2 bg-paper text-ink">
      <div className="flex flex-wrap items-center justify-end gap-x-1.5 gap-y-1 min-h-11">
        {!isFirstScreen && (
          <Button
            back
            border=""
            color="bg-transparent text-ink"
            className="-ml-2"
            title="Go Back"
          >
            <BackIcon />
          </Button>
        )}
        <h1 className="flex-1 self-center py-1 font-display text-[26px] leading-tight font-bold tracking-[-0.02em] overflow-hidden text-ellipsis whitespace-nowrap">
          {title}
        </h1>
        {changeButtonColors(buttons)}
      </div>
      <div className="empty:hidden flex flex-col gap-y-1.5 pt-1.5 text-sm font-bold text-accent">
        {subhead}
      </div>
    </div>
  );
}
