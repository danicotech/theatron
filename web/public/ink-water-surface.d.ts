/** Shared by the standalone study and the production ink controller. */
export class InkWaterSurface {
  constructor(host: HTMLElement, options?: { variant?: 'a' | 'b' | 'c'; refract?: HTMLElement });
  readonly canvas: HTMLCanvasElement;
  readonly active: boolean;
  press(x?: number, y?: number): void;
  move(x: number, y: number): void;
  release(): void;
  pulse(x?: number, y?: number): void;
  step(dt: number): void;
  seek(progress: number): void;
  resize(): void;
  refreshPalette(): void;
  clear(): void;
  destroy(): void;
}
