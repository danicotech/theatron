/** Local, opt-in diagnostics for the ignition interval; no telemetry. */
export function openingPerformance(signal: AbortSignal) {
  if (new URLSearchParams(location.search).get('perf') !== '1') return;
  const output = document.createElement('output');
  output.id = 'opening-performance';
  output.hidden = true;
  document.body.append(output);
  const frames: number[] = [],
    paints: number[] = [],
    tasks: number[] = [];
  let frame = 0,
    start = 0,
    last = 0;
  let observer: PerformanceObserver | undefined;
  const stop = () => {
    cancelAnimationFrame(frame);
    observer?.disconnect();
  };
  const tick = (now: number) => {
    frames.push(now - last);
    last = now;
    frame = requestAnimationFrame(tick);
  };
  signal.addEventListener(
    'abort',
    () => {
      stop();
      output.remove();
    },
    { once: true },
  );
  return {
    start() {
      start = last = performance.now();
      frame = requestAnimationFrame(tick);
      try {
        observer = new PerformanceObserver((list) => {
          for (const item of list.getEntries())
            if (item.startTime >= start) tasks.push(item.duration);
        });
        observer.observe({ type: 'longtask' });
      } catch {
        /* Not exposed by every browser. */
      }
    },
    paint(ms: number) {
      paints.push(ms);
    },
    finish() {
      if (!start) return;
      stop();
      const sorted = [...frames].sort((a, b) => a - b);
      output.textContent = JSON.stringify({
        duration: Math.round(performance.now() - start),
        frames: frames.length,
        p95: Math.round(sorted[Math.floor(sorted.length * 0.95)] || 0),
        worst: Math.round(Math.max(0, ...frames)),
        over50: frames.filter((ms) => ms > 50).length,
        paintCount: paints.length,
        paintMs: Math.round(paints.reduce((a, b) => a + b, 0)),
        paintMax: Math.round(Math.max(0, ...paints) * 100) / 100,
        longTasks: tasks.length,
        longTaskMs: Math.round(tasks.reduce((a, b) => a + b, 0)),
      });
      output.dataset.complete = 'true';
    },
  };
}
