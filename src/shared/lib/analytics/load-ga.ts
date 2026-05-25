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

  if (measurementId.length === 0) {
    window.dataLayer = window.dataLayer ?? [];
    const devGtag: GtagFn = (...args) => {
      window.dataLayer?.push(args);
      if (import.meta.env.DEV) {
        console.debug('[gtag:dev]', ...args);
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
  const gtag: GtagFn = (...args) => {
    window.dataLayer?.push(args);
  };
  window.gtag = gtag;

  gtag('js', new Date());
  gtag('config', measurementId, { send_page_view: false });
}
