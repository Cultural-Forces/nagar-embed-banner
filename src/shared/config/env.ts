type Env = {
  readonly GA4_ID: string;
};

const fromMeta = (key: string, fallback: string): string => {
  const value = (import.meta.env as Record<string, string | undefined>)[key];
  return typeof value === 'string' && value.length > 0 ? value : fallback;
};

export const env: Env = {
  GA4_ID: fromMeta('VITE_GA4_ID', ''),
};
