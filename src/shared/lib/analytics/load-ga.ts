type GtagFn = (...args: unknown[]) => void;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: GtagFn;
  }
}

let loaded = false;

export function loadGa(measurementId: string): void {
  if (loaded) return;
  loaded = true;

  // gtag.js only processes Arguments objects from dataLayer and silently skips
  // arrays, so gtag must be a regular function pushing `arguments`, not `...args`.
  if (measurementId.length === 0) {
    window.dataLayer = window.dataLayer ?? [];
    const devGtag: GtagFn = function () {
      window.dataLayer?.push(arguments);
      if (import.meta.env.DEV) {
        console.debug('[gtag:dev]', ...Array.from(arguments));
      }
    };
    window.gtag = devGtag;
    return;
  }

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer ?? [];
  const gtag: GtagFn = function () {
    window.dataLayer?.push(arguments);
  };
  window.gtag = gtag;

  gtag('js', new Date());
  // page_view stays on: it carries source, device and city; UTM tags are parsed by GA4
  gtag('config', measurementId);
}
