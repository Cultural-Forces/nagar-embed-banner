export type BannerConfig = {
  readonly coverUrl: string;
  readonly nagarUrl: string;
  readonly redirectPath: string;
  readonly hintText: string;
};

export type Point = {
  readonly x: number;
  readonly y: number;
};

export type ErasureGrid = {
  readonly size: number;
  readonly cells: Uint8Array;
};

export type RevealState = {
  readonly ratio: number;
  readonly thresholdReached: boolean;
};
