import { IneligibleReason } from '@/api/ll';

/**
 * Disney's reason a guest cannot book, said the way the person holding the
 * phone would say it. The booking screen used to show the code itself
 * ("EXPERIENCE LIMIT REACHED") and Plan Check the raw constant, underscores
 * and all. A code this does not know is shown as the code, so a new one from
 * Disney still says something.
 */
const REASONS: Record<IneligibleReason, string> = {
  INVALID_PARK_ADMISSION: 'No park ticket for this day',
  PARK_RESERVATION_NEEDED: 'Needs a park reservation',
  GENIE_PLUS_NEEDED: 'No Multi Pass for this day',
  MULTI_PASS_NEEDED: 'No Multi Pass for this day',
  EXPERIENCE_LIMIT_REACHED: 'Already booked this one today',
  TOO_EARLY: 'Cannot book again yet',
  TOO_EARLY_FOR_PARK_HOPPING: 'Too early to park hop',
  TOO_EARLY_FOR_NEXT_PARK: 'Too early for the next park',
  NOT_IN_PARTY: 'Not in your saved party',
  REDEMPTION_NEEDED: 'Must tap in to a held pass first',
  TIER_LIMIT_REACHED: 'Already holds a Tier 1 until someone taps in',
};

export function reasonText(reason: string | undefined): string {
  if (!reason) return 'Not eligible';
  return REASONS[reason as IneligibleReason] ?? reason.replace(/_/g, ' ');
}
