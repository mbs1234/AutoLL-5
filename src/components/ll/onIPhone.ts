/** iPhone or iPad Safari, including an iPad that says it is a Mac. */
export function onIPhone(): boolean {
  if (typeof navigator === 'undefined') return false;
  return (
    /iP(hone|od|ad)/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}
