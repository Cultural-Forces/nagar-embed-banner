type EventParams = Record<string, string | number | boolean>;

const sentOnce = new Set<string>();

export function sendGaEvent(
  name: string,
  params?: EventParams,
  options: { once?: boolean } = {},
): void {
  if (options.once === true) {
    if (sentOnce.has(name)) return;
    sentOnce.add(name);
  }

  const gtag = window.gtag;
  if (typeof gtag !== 'function') return;

  if (params === undefined) {
    gtag('event', name);
  } else {
    gtag('event', name, params);
  }
}
