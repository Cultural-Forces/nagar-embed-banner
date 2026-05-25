export const EVENT_NAMES = {
  IMPRESSION: 'banner_impression',
  SCRATCH_START: 'banner_scratch_start',
  REVEAL_COMPLETE: 'banner_reveal_complete',
  CLICK: 'banner_click',
} as const;

/** Радіус мазка стирання у частці від сторони баннера (0.09 = 9% від ширини). */
export const RADIUS_RATIO = 0.09;

/** Частка стертої площі, після якої вважаємо банер «розкритим» (0.6 = 60%). */
export const REVEAL_THRESHOLD = 0.75;

/** Розмір сітки маски (64×64 клітинки) для підрахунку прогресу стирання. */
export const GRID_SIZE = 64;

/** Максимальна тривалість натискання (мс), щоб жест вважався «тапом», а не драгом. */
export const TAP_MAX_MS = 250;

/** Максимальне зміщення курсора (px), щоб жест залишався «тапом», а не драгом. */
export const TAP_MAX_PX = 10;

/** Інтервал (мс) між обчисленнями відсотка стирання — щоб не рахувати на кожен pointermove. */
export const REVEAL_SAMPLE_INTERVAL_MS = 200;

/** Затримка (мс) перед прихованням підказки після першого руху користувача. */
export const HINT_HIDE_DELAY_MS = 400;

/** Текст CTA-кнопки fallback-режиму (коли асети не завантажились). */
export const FALLBACK_LABEL = 'Слухати альбом';
