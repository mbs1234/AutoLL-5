import { use } from 'react';

import { FlexExperience } from '@/api/ll';
import Button from '@/components/Button';
import { Time } from '@/components/Time';
import NavContext from '@/contexts/NavContext';

import BookExperience from '../BookExperience';

export default function LLButton({
  experience,
}: {
  experience: FlexExperience;
}) {
  const { goTo } = use(NavContext);
  const { flex, standby } = experience;

  return (
    // A return time is the thing on this screen you act on, so it is drawn
    // as a chip in the park's colour; "none" is quiet, and still opens the
    // attraction, exactly as before.
    <Button
      onClick={() => goTo(<BookExperience experience={experience} />)}
      color={
        flex.nextAvailableTime || standby.unavailableReason === 'CLOSED'
          ? 'bg-white text-accent'
          : 'bg-gray-100 text-gray-600'
      }
      border={
        flex.nextAvailableTime || standby.unavailableReason === 'CLOSED'
          ? 'border-2 border-accent'
          : 'border-2 border-transparent'
      }
      className="font-extrabold!"
    >
      {standby.unavailableReason === 'CLOSED' ? (
        'Book'
      ) : flex.nextAvailableTime ? (
        <Time time={flex.nextAvailableTime} />
      ) : (
        'none'
      )}
    </Button>
  );
}
