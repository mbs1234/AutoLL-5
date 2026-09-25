import { reasonText } from './ineligibleReason';

describe('reasonText', () => {
  it('says a known reason in plain words', () => {
    expect(reasonText('EXPERIENCE_LIMIT_REACHED')).toBe(
      'Already booked this one today'
    );
    expect(reasonText('NOT_IN_PARTY')).toBe('Not in your saved party');
  });

  // A code Disney adds later still says something rather than nothing.
  it('falls back to the code, spaced, for one it does not know', () => {
    expect(reasonText('SOME_NEW_REASON')).toBe('SOME NEW REASON');
  });

  it('says "Not eligible" when Disney gives no reason', () => {
    expect(reasonText(undefined)).toBe('Not eligible');
  });
});
