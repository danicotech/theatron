type Point = { x: number; y: number };
export type BurnPoint = Point;
export type BurnParticles = {
  render: (
    edge: Point[],
    time: number,
    dt: number,
    fade: number,
    emitting: boolean,
    progress: number,
  ) => void;
  dispose: () => void;
};
type Edge = Point & { key: string };
const hash = (x: number, y: number) => {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
};
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
function noise(x: number, y: number) {
  const ix = Math.floor(x),
    iy = Math.floor(y);
  const fx = x - ix,
    fy = y - iy;
  const u = fx * fx * (3 - 2 * fx),
    v = fy * fy * (3 - 2 * fy);
  return mix(
    mix(hash(ix, iy), hash(ix + 1, iy), u),
    mix(hash(ix, iy + 1), hash(ix + 1, iy + 1), u),
    v,
  );
}

/** Connected arrival-time field: local fibre resistance and upward heat, not a radial wipe. */
export function createBurnField(width: number, height: number, origin: Point, resolution = 96) {
  const step = Math.max(10, Math.max(width, height) / resolution);
  const sx = Math.ceil(origin.x / step) + 2,
    sy = Math.ceil(origin.y / step) + 2;
  const left = origin.x - sx * step,
    top = origin.y - sy * step;
  const cols = Math.ceil((width - left) / step) + 3;
  const rows = Math.ceil((height - top) / step) + 3;
  const count = cols * rows,
    start = sy * cols + sx;
  const arrival = new Float64Array(count).fill(Infinity);
  const resistance = new Float64Array(count);
  const points = Array.from({ length: count }, (_, i) => ({
    x: left + (i % cols) * step,
    y: top + Math.floor(i / cols) * step,
  }));
  points.forEach((pt, i) => {
    const fibre = noise(pt.x / 77, pt.y / 43);
    resistance[i] = 0.24 + Math.pow(fibre, 2.2) * 5.8 + noise(pt.x / 22, pt.y / 29) * 0.5;
  });
  // Small binary heap keeps ignition setup bounded on mobile.
  const heap: { id: number; cost: number }[] = [];
  const push = (id: number, cost: number) => {
    const item = { id, cost };
    let i = heap.length;
    heap.push(item);
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (heap[parent]!.cost <= cost) break;
      heap[i] = heap[parent]!;
      i = parent;
    }
    heap[i] = item;
  };
  const pop = () => {
    const first = heap[0]!,
      last = heap.pop()!;
    if (heap.length) {
      let i = 0;
      while (i * 2 + 1 < heap.length) {
        let child = i * 2 + 1;
        if (child + 1 < heap.length && heap[child + 1]!.cost < heap[child]!.cost) child++;
        if (heap[child]!.cost >= last.cost) break;
        heap[i] = heap[child]!;
        i = child;
      }
      heap[i] = last;
    }
    return first;
  };
  arrival[start] = 0;
  push(start, 0);
  while (heap.length) {
    const current = pop();
    if (current.cost !== arrival[current.id]) continue;
    const x = current.id % cols,
      y = Math.floor(current.id / cols);
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        if ((!dx && !dy) || x + dx < 0 || x + dx >= cols || y + dy < 0 || y + dy >= rows) continue;
        const id = (y + dy) * cols + x + dx;
        const buoyancy = dy < 0 ? 0.64 : dy > 0 ? 1.3 : 1;
        const cost =
          current.cost +
          Math.hypot(dx, dy) * buoyancy * (resistance[id]! + resistance[current.id]!) * 0.5;
        if (cost < arrival[id]!) {
          arrival[id] = cost;
          push(id, cost);
        }
      }
  }
  let max = 0;
  points.forEach((p, i) => {
    if (p.x >= -step && p.x <= width + step && p.y >= -step && p.y <= height + step)
      max = Math.max(max, arrival[i]!);
  });
  for (let i = 0; i < count; i++) arrival[i] = arrival[i]! / max;
  // An unburned margin closes every contour outside the visible viewport.
  for (let i = 0; i < count; i++)
    if (i % cols === 0 || i % cols === cols - 1 || i < cols || i >= count - cols) arrival[i] = 4;

  function contours(progress: number) {
    const links = new Map<string, Edge[]>();
    const vertices = new Map<string, Edge>();
    const intersect = (a: number, b: number): Edge => {
      const key = a < b ? `${a}:${b}` : `${b}:${a}`;
      const cached = vertices.get(key);
      if (cached) return cached;
      const t = (progress - arrival[a]!) / (arrival[b]! - arrival[a]!);
      const p = {
        key,
        x: mix(points[a]!.x, points[b]!.x, t),
        y: mix(points[a]!.y, points[b]!.y, t),
      };
      vertices.set(key, p);
      return p;
    };
    const triangle = (ids: number[]) => {
      const cut: Edge[] = [];
      for (let i = 0; i < 3; i++) {
        const a = ids[i]!,
          b = ids[(i + 1) % 3]!;
        if (arrival[a]! < progress !== arrival[b]! < progress) cut.push(intersect(a, b));
      }
      if (cut.length === 2) {
        const [a, b] = cut as [Edge, Edge];
        links.set(a.key, [...(links.get(a.key) ?? []), b]);
        links.set(b.key, [...(links.get(b.key) ?? []), a]);
      }
    };
    for (let y = 0; y < rows - 1; y++)
      for (let x = 0; x < cols - 1; x++) {
        const a = y * cols + x,
          b = a + 1,
          c = a + cols + 1,
          d = a + cols;
        triangle([a, b, c]);
        triangle([a, c, d]);
      }
    const visited = new Set<string>();
    const loops: Point[][] = [];
    for (const [key, first] of vertices) {
      if (visited.has(key)) continue;
      const loop: Point[] = [];
      let current: Edge | undefined = first;
      while (current && !visited.has(current.key)) {
        visited.add(current.key);
        loop.push(current);
        current = links.get(current.key)?.find((p) => !visited.has(p.key));
      }
      if (loop.length > 2) loops.push(loop);
    }
    return loops;
  }
  return { contours, arrival, points, start };
}

export type BurnPigments = {
  soot: string;
  char: string;
  flame: string;
  core: string;
  smoke: string;
  ash: string;
};
type Particle = Point & {
  vx: number;
  vy: number;
  age: number;
  life: number;
  size: number;
  spin: number;
  kind: number;
};

export function createPaperBurn(
  ctx: CanvasRenderingContext2D,
  backdrop: HTMLElement | null,
  width: number,
  height: number,
  origin: Point,
  colors: BurnPigments,
  gpu: BurnParticles | null = null,
  field = createBurnField(width, height, origin),
) {
  const particles: Particle[] = [];
  let lastTime = 0,
    emission = 0;
  const smoke = document.createElement('canvas');
  smoke.width = smoke.height = 64;
  const sc = smoke.getContext('2d');
  if (sc) {
    const gradient = sc.createRadialGradient(32, 32, 2, 32, 32, 32);
    gradient.addColorStop(0, colors.smoke);
    gradient.addColorStop(1, 'transparent');
    sc.fillStyle = gradient;
    sc.fillRect(0, 0, 64, 64);
  }
  const pathOf = (loops: Point[][]) =>
    loops
      .map(
        (loop) =>
          loop.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ') + 'Z',
      )
      .join(' ');
  return (progress: number, time: number) => {
    const dt = Math.min(0.05, Math.max(0, time - lastTime));
    lastTime = time;
    // Final part of the timeline lets ash and smoke die away after the paper is gone.
    const p = Math.min(1.02, progress * 1.18);
    const loops = field.contours(Math.max(0.0001, p));
    if (backdrop)
      backdrop.style.clipPath =
        p >= 1 ? 'path("M0 0")' : `path(evenodd, "M0 0H${width}V${height}H0Z ${pathOf(loops)}")`;
    ctx.clearRect(0, 0, width, height);
    const edge = loops
      .flat()
      .filter((pt) => pt.x > -15 && pt.x < width + 15 && pt.y > -15 && pt.y < height + 15);
    const fade = Math.min(1, Math.max(0, (1 - progress) * 7));
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    if (p < 1) {
      // Sparse soot flecks, never a continuous outline around the cut.
      for (let i = 0; i < edge.length; i += 2) {
        const point = edge[i]!;
        const fibre = noise(point.x / 17, point.y / 13);
        if (fibre < 0.58) continue;
        const size = 2 + (fibre - 0.58) * 14;
        ctx.globalAlpha = fade * 0.55;
        ctx.drawImage(smoke, point.x - size, point.y - size, size * 2, size * 2);
      }
      // Translucent ribbons rise from local hot spots; never point radially outwards.
      let spacing = 0;
      for (let i = 1; !gpu && i < edge.length; i++) {
        const a = edge[i - 1]!,
          b = edge[i]!;
        spacing += Math.min(25, Math.hypot(b.x - a.x, b.y - a.y));
        if (spacing < 34) continue;
        spacing = 0;
        const heat = noise(b.x / 46 + time * 0.65, b.y / 39);
        if (heat < 0.43) continue;
        const length = 12 + heat * heat * 65 + Math.sin(time * 13 + b.x * 0.04) * 8;
        const breadth = 4 + heat * 11;
        const sway = Math.sin(time * 8 + b.x * 0.028) * 24 + Math.sin(time * 3.1) * 9;
        const grad = ctx.createLinearGradient(b.x, b.y, b.x + sway, b.y - length);
        grad.addColorStop(0, colors.flame);
        grad.addColorStop(0.16, colors.core);
        grad.addColorStop(0.4, colors.flame);
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.globalAlpha = fade * (0.24 + heat * 0.4);
        ctx.beginPath();
        ctx.moveTo(b.x - breadth, b.y + 2);
        ctx.bezierCurveTo(
          b.x - breadth * 1.7,
          b.y - length * 0.3,
          b.x + sway * 1.8,
          b.y - length * 0.65,
          b.x + sway,
          b.y - length,
        );
        ctx.bezierCurveTo(
          b.x - sway * 0.5,
          b.y - length * 0.48,
          b.x + breadth,
          b.y - length * 0.3,
          b.x + breadth,
          b.y + 2,
        );
        ctx.fill();
      }
    }
    emission += dt * (gpu ? 35 : 60);
    while (emission >= 1 && p < 1 && edge.length && particles.length < (gpu ? 130 : 80)) {
      emission--;
      const pos = edge[Math.floor(Math.random() * edge.length)]!;
      const kind = gpu ? 1 : Math.random() < 0.45 ? 0 : Math.random() < 0.55 ? 1 : 2;
      particles.push({
        ...pos,
        kind,
        vx: (Math.random() - 0.5) * 35,
        vy: -(kind ? 35 + Math.random() * 65 : 28),
        age: 0,
        life: kind ? 0.45 + Math.random() * 0.65 : 0.9 + Math.random() * 0.5,
        size:
          kind === 0
            ? 20 + Math.random() * 23
            : kind === 1
              ? 2 + Math.random() * 4
              : 0.7 + Math.random(),
        spin: Math.random() * 6,
      });
    }
    emission = Math.min(emission, 2);
    for (let i = particles.length - 1; i >= 0; i--) {
      const particle = particles[i]!;
      particle.age += dt;
      if (particle.age >= particle.life) {
        particles.splice(i, 1);
        continue;
      }
      particle.x += (particle.vx + Math.sin(time * 3 + particle.spin) * 14) * dt;
      particle.y += particle.vy * dt;
      particle.vy -= dt * 13;
      const life = particle.age / particle.life;
      if (!particle.kind) {
        const size = particle.size * (1 + life * 2.8);
        ctx.globalAlpha = Math.sin(life * Math.PI) * 0.26 * fade;
        ctx.drawImage(smoke, particle.x - size / 2, particle.y - size / 2, size, size);
      } else {
        ctx.save();
        ctx.translate(particle.x, particle.y);
        ctx.rotate(particle.spin + life * 4);
        ctx.globalAlpha = (1 - life) * fade * (particle.kind === 1 ? 0.7 : 0.9);
        ctx.fillStyle = particle.kind === 1 ? colors.ash : life < 0.45 ? colors.core : colors.flame;
        ctx.beginPath();
        ctx.moveTo(-particle.size, 0);
        ctx.lineTo(0, -particle.size * 0.4);
        ctx.lineTo(particle.size * 0.6, particle.size);
        ctx.lineTo(-particle.size * 0.3, particle.size * 0.5);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
    gpu?.render(edge, time, dt, fade, p < 1, p);
  };
}
