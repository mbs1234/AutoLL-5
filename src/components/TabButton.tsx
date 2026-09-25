import { use } from 'react';

import TabsContext, { TabDef } from '@/contexts/TabContext';

export default function TabButton<N extends string>({ name, icon }: TabDef<N>) {
  const { active, changeTab } = use(TabsContext);
  if (!changeTab) return null;
  const isActive = active?.name === name;
  return (
    <button
      className={`px-1.5 pt-1.5 pb-2 ${isActive ? 'text-accent font-bold' : 'text-gray-600 font-semibold'}`}
      aria-current={isActive ? 'page' : undefined}
      onClick={() => changeTab(name)}
    >
      <div
        className={`flex min-w-14 justify-center rounded-full py-1 ${isActive ? 'bg-accent/12' : ''}`}
      >
        {icon}
      </div>
      <div className="mt-1 text-xs">{name}</div>
    </button>
  );
}
