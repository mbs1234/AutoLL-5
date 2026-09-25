import { use } from 'react';

import GuestList from '@/components/GuestList';
import PartyContext from '@/contexts/PartyContext';
import { formatTime } from '@/datetime';

import { reasonText } from './ineligibleReason';

export default function IneligibleGuestList() {
  const { ineligible } = use(PartyContext);
  return (
    <GuestList
      guests={ineligible}
      conflicts={Object.fromEntries(
        ineligible.map(g => [
          g.id,
          g.eligibleAfter
            ? `Eligible at ${formatTime(g.eligibleAfter)}`
            : g.ineligibleReason
              ? reasonText(g.ineligibleReason)
              : 'Eligible for a new booking',
        ])
      )}
    />
  );
}
