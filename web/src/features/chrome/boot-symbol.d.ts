declare module '*boot-symbol.js' {
  export function createBootSymbol(boot: HTMLElement, signal: AbortSignal): () => void;
}
