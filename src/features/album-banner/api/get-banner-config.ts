import { env } from '../../../shared/config/env';
import type { BannerConfig } from '../shared/types';

export function getBannerConfig(): BannerConfig {
  return {
    coverUrl: env.COVER_URL,
    nagarUrl: env.NAGAR_URL,
    redirectPath: env.REDIRECT_PATH,
    hintText: env.HINT_TEXT,
  };
}
