/** Opt-in, bounded local diagnostics; no telemetry or persistent animation loop. */
export function performanceProbe(signal: AbortSignal) {
  if (new URLSearchParams(location.search).get('perf') !== '1') return;
  const node = document.createElement('output');
  node.hidden = true;
  node.id = 'chapter-performance';
  document.body.append(node);
  const start = performance.now();
  const frames: number[] = [];
  const tasks: number[] = [];
  let last = start,
    frame = 0;
  let observer: PerformanceObserver | undefined;
  try {
    observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries())
        if (entry.startTime >= start) tasks.push(entry.duration);
    });
    observer.observe({ type: 'longtask', buffered: true });
  } catch {
    /* Some browsers do not expose long tasks. */
  }
  const tick = (now: number) => {
    frames.push(now - last);
    last = now;
    if (now - start < 10000) {
      frame = requestAnimationFrame(tick);
      return;
    }
    observer?.disconnect();
    const sorted = [...frames].sort((a, b) => a - b);
    node.textContent = JSON.stringify({
      windowMs: Math.round(now - start),
      frames: frames.length,
      frameP95: Math.round(sorted[Math.floor(sorted.length * 0.95)] || 0),
      worstFrame: Math.round(Math.max(...frames)),
      framesOver50: frames.filter((ms) => ms > 50).length,
      longTasks: tasks.length,
      longTaskMs: Math.round(tasks.reduce((a, b) => a + b, 0)),
      longestTask: Math.round(Math.max(0, ...tasks)),
      images: document.images.length,
      loadedImages: [...document.images].filter((image) => image.complete && image.naturalWidth)
        .length,
      canvases: document.querySelectorAll('canvas').length,
    });
    node.dataset.complete = 'true';
  };
  frame = requestAnimationFrame(tick);
  signal.addEventListener(
    'abort',
    () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      node.remove();
    },
    { once: true },
  );
}
