import { memo, use } from 'react';

import { Booking } from '@/api/itinerary';
import { Park } from '@/api/resort';
import { Day } from '@/components/Day';
import Tab from '@/components/Tab';
import PlansContext from '@/contexts/PlansContext';
import { DEFAULT_THEME } from '@/contexts/ThemeContext';
import { parkDate } from '@/datetime';

import { ScreenProps } from '../../Screen';
import BookingListing from '../BookingListing';
import NoPlans from '../NoPlans';
import NotLoaded from '../NotLoaded';
import RefreshButton from './RefreshButton';

export default function Plans(props: Partial<ScreenProps>) {
  const { plans, refreshPlans, loaderElem, plansLoaded } = use(PlansContext);

  return (
    <Tab
      title="Plans"
      buttons={<RefreshButton name="Plans" onClick={refreshPlans} />}
      theme={DEFAULT_THEME}
      {...props}
    >
      {plans.length === 0 && !plansLoaded ? (
        <NotLoaded what="Plans" onRefresh={refreshPlans} />
      ) : (
        <PlansList plans={plans} />
      )}
      {loaderElem}
    </Tab>
  );
}

const PlansList = memo(function PlansList({ plans }: { plans: Booking[] }) {
  const plansByDate = new Map<string, Booking[]>();
  const parksByDate = new Map<string, Set<Park>>();
  for (const plan of plans) {
    const date = parkDate(plan.start);
    if (!plansByDate.has(date)) plansByDate.set(date, []);
    if (plan.type !== 'APR') plansByDate.get(date)?.push(plan);
    if (!parksByDate.has(date)) parksByDate.set(date, new Set());
    if ((plan.type !== 'LL' || !plan.choices) && plan.park.icon) {
      parksByDate.get(date)?.add(plan.park as Park);
    }
  }

  return (
    <ul>
      {plans.length > 0 ? (
        [...plansByDate].map(([date, plans]) => (
          <li key={date}>
            {/* The day as a quiet label, as the tip board labels its tiers,
                kept at the top on the page's own paper while its plans scroll
                under it. */}
            <div className="sticky top-0 z-10 -mx-3 bg-paper px-3 pt-3 pb-2">
              <div className="flex items-center">
                <h2 className="mt-0 flex-1 px-1 text-[13px] font-bold tracking-wide text-gray-600 uppercase">
                  <Day>{date}</Day>
                </h2>
                <ul className="pr-1 text-lg text-right">
                  {[...(parksByDate.get(date) ?? [])].map(park => (
                    <li
                      key={park.id}
                      className="inline ml-1 first:ml-0"
                      aria-label={park.name}
                    >
                      {park.icon}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            {plans.length > 0 ? (
              <ul className="divide-y divide-gray-200 overflow-hidden rounded-[18px] border border-gray-300 bg-white px-3 [&>li]:py-3">
                {plans.map(booking => (
                  <li key={booking.id} data-testid="plan">
                    <BookingListing details booking={booking} />
                  </li>
                ))}
              </ul>
            ) : (
              <NoPlans />
            )}
          </li>
        ))
      ) : (
        <NoPlans />
      )}
    </ul>
  );
});
