type Env = {
  readonly GA4_ID: string;
  readonly REDIRECT_PATH: string;
  readonly COVER_URL: string;
  readonly NAGAR_URL: string;
  readonly HINT_TEXT: string;
};

const fromMeta = (key: string, fallback: string): string => {
  const value = (import.meta.env as Record<string, string | undefined>)[key];
  return typeof value === 'string' && value.length > 0 ? value : fallback;
};

export const env: Env = {
  GA4_ID: fromMeta('VITE_GA4_ID', ''),
  REDIRECT_PATH: fromMeta('VITE_REDIRECT_PATH', '/go'),
  COVER_URL: fromMeta('VITE_COVER_URL', '/cover.webp'),
  NAGAR_URL: fromMeta('VITE_NAGAR_URL', '/nagar.webp'),
  HINT_TEXT: fromMeta('VITE_HINT_TEXT', 'Проведіть, щоб відкрити'),
};
