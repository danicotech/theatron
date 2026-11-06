/** A shared height/velocity field; dragging pushes one continuous surface. */
let refractionId = 0;
export class InkWaterSurface {
  constructor(host, { variant = 'b', refract } = {}) {
    this.host = host;
    this.variant = variant;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'water-light';
    this.canvas.setAttribute('aria-hidden', 'true');
    this.ctx = this.canvas.getContext('2d', { alpha: true });
    if (!this.ctx) throw new Error('Water lighting requires a 2D canvas context');
    // Keep the solver bounded; render its lighting into a separate HiDPI surface.
    this.lightMap = document.createElement('canvas');
    this.lightContext = this.lightMap.getContext('2d');
    if (!this.lightContext) throw new Error('Water lighting requires a buffer context');
    host.prepend(this.canvas);
    this.held = false;
    this.energy = 0;
    this.time = 0;
    this.pressure = 0;
    this.point = this.previous = { x: .5, y: .5 };
    this.resize();
    this.refreshPalette();
    if (refract) this.attachRefraction(refract);
  }
  attachRefraction(target) {
    const map = document.createElement('canvas');
    const ctx = map.getContext('2d');
    if (!ctx) return;
    const ns = 'http://www.w3.org/2000/svg';
    const defs = document.createElementNS(ns, 'svg');
    defs.classList.add('water-refraction-defs');
    defs.setAttribute('width', '0'); defs.setAttribute('height', '0');
    defs.setAttribute('aria-hidden', 'true');
    defs.style.cssText = 'position:absolute;pointer-events:none;overflow:hidden';
    const filter = document.createElementNS(ns, 'filter');
    const id = `ink-water-refraction-${++refractionId}`;
    filter.id = id;
    filter.setAttribute('filterUnits', 'userSpaceOnUse');
    filter.setAttribute('x', '0'); filter.setAttribute('y', '0');
    filter.setAttribute('color-interpolation-filters', 'sRGB');
    const image = document.createElementNS(ns, 'feImage');
    image.setAttribute('preserveAspectRatio', 'none');
    image.setAttribute('result', 'water-normal');
    const displacement = document.createElementNS(ns, 'feDisplacementMap');
    displacement.setAttribute('in', 'SourceGraphic');
    displacement.setAttribute('in2', 'water-normal');
    displacement.setAttribute('scale', '7');
    displacement.setAttribute('xChannelSelector', 'R');
    displacement.setAttribute('yChannelSelector', 'G');
    filter.append(image, displacement); defs.append(filter);
    const original = target.style.getPropertyValue('filter');
    const priority = target.style.getPropertyPriority('filter');
    const base = getComputedStyle(target).filter;
    const width = target.offsetWidth || this.width, height = target.offsetHeight || this.height;
    for (const node of [filter, image]) {
      node.setAttribute('width', String(width)); node.setAttribute('height', String(height));
    }
    this.refraction = { target, map, ctx, defs, filter, image, original, priority, id, last: -1 };
    try {
      this.drawRefraction(true);
      document.body.append(defs);
      target.style.setProperty('filter', `${base && base !== 'none' ? base + ' ' : ''}url(#${id})`);
    } catch {
      // Canvas export/filter support is optional; full-surface lighting still works.
      defs.remove(); this.refraction = null;
    }
  }
  drawRefraction(force = false) {
    const r = this.refraction;
    if (!r || (!force && this.time - r.last < 1 / 30)) return;
    r.last = this.time;
    const w = this.cols, rows = this.rows;
    if (r.map.width !== w || r.map.height !== rows) {
      r.map.width = w; r.map.height = rows;
      r.pixels = r.ctx.createImageData(w, rows);
    }
    const field = this.heightField, data = r.pixels.data;
    for (let y = 0; y < rows; y++) for (let x = 0; x < w; x++) {
      const nx = field[y * w + Math.min(w - 1, x + 1)] - field[y * w + Math.max(0, x - 1)];
      const ny = field[Math.min(rows - 1, y + 1) * w + x] - field[Math.max(0, y - 1) * w + x];
      // Same normals as the light. Taper only at the outermost edge to keep the hit box crisp.
      const edge = Math.min(1, x / 2, y / 2, (w - 1 - x) / 2, (rows - 1 - y) / 2);
      const i = (y * w + x) * 4;
      data[i] = 128 + Math.tanh(nx * 5) * 110 * edge;
      data[i + 1] = 128 + Math.tanh(ny * 5) * 110 * edge;
      data[i + 2] = 128; data[i + 3] = 255;
    }
    r.ctx.putImageData(r.pixels, 0, 0);
    r.image.setAttribute('href', r.map.toDataURL());
  }
  refreshPalette() {
    const css = getComputedStyle(this.host);
    const rgb = value => {
      this.ctx.clearRect(0, 0, 1, 1);
      this.ctx.fillStyle = value;
      this.ctx.fillRect(0, 0, 1, 1);
      return [...this.ctx.getImageData(0, 0, 1, 1).data].slice(0, 3);
    };
    this.light = rgb(css.getPropertyValue('--ink-light').trim());
    this.shadow = rgb(css.getPropertyValue('--ink-shadow').trim());
    this.draw();
  }
  resize() {
    const width = Math.max(1, this.host.clientWidth), height = Math.max(1, this.host.clientHeight);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (width === this.width && height === this.height && dpr === this.dpr) return;
    this.dpr = dpr;
    this.width = width; this.height = height;
    this.scale = Math.min(.5, 640 / width, 160 / height);
    this.cols = Math.max(8, Math.round(width * this.scale));
    this.rows = Math.max(8, Math.round(height * this.scale));
    const outputScale = Math.min(dpr, 2560 / width, Math.sqrt(600000 / (width * height)));
    this.canvas.width = Math.max(1, Math.round(width * outputScale));
    this.canvas.height = Math.max(1, Math.round(height * outputScale));
    this.lightMap.width = this.cols; this.lightMap.height = this.rows;
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = 'high';
    this.heightField = new Float32Array(this.cols * this.rows);
    this.velocity = new Float32Array(this.cols * this.rows);
    this.pixels = this.ctx.createImageData(this.cols, this.rows);
    this.energy = 0;
    this.draw();
  }
  move(x, y) {
    this.point = { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) };
  }
  press(x = .5, y = .5) {
    // A brief click needs an immediate impact; the sustained pressure ramps up
    // too slowly to make a visible wave before a quick pointerup.
    if (!this.held) this.pulse(x, y);
    else this.move(x, y);
    this.held = true;
  }
  release() { this.held = false; }
  pulse(x = .5, y = .5) {
    this.move(x, y); this.previous = { ...this.point };
    this.disturb(this.point.x, this.point.y, 20, 1.5);
    this.energy = 1;
  }
  get active() { return this.held || this.pressure > .002 || this.energy > .00006; }

  // Smooth pressure with a compensating rim: it displaces water, rather than
  // creating independent expanding sprites or adding water at each mouse event.
  disturb(x, y, impulse, spread = 1) {
    const cx = x * (this.cols - 1), cy = y * (this.rows - 1);
    const radius = Math.max(2, (this.variant === 'a' ? 9 : this.variant === 'b' ? 15 : 12) * this.scale * spread);
    const reach = radius * 3;
    for (let j = Math.max(0, Math.floor(cy - reach)); j <= Math.min(this.rows - 1, Math.ceil(cy + reach)); j++) {
      for (let i = Math.max(0, Math.floor(cx - reach)); i <= Math.min(this.cols - 1, Math.ceil(cx + reach)); i++) {
        const q = ((i - cx) ** 2 + (j - cy) ** 2) / (radius * radius);
        this.velocity[j * this.cols + i] -= impulse * (1 - q / 2) * Math.exp(-q / 2);
      }
    }
  }
  step(dt) {
    dt = Math.max(0, Math.min(.05, dt));
    if (!dt) return;
    const count = Math.max(1, Math.ceil(dt * 180)), h = dt / count;
    const from = this.previous, to = this.point;
    const distance = Math.hypot((to.x - from.x) * this.width, (to.y - from.y) * this.height);
    const force = 250 + Math.min(650, distance / dt * .8);
    const damping = this.variant === 'c' ? 1.8 : this.variant === 'a' ? 2.6 : 3.1;
    const attenuation = Math.exp(-damping * h), c2 = (145 * this.scale) ** 2;
    const w = this.cols, rows = this.rows, field = this.heightField, velocity = this.velocity;
    for (let s = 0; s < count; s++) {
      this.time += h;
      this.pressure += ((this.held ? 1 : 0) - this.pressure) * (1 - Math.exp(-h * (this.held ? 25 : 12)));
      if (this.pressure > .002) {
        const a = s / count, b = (s + 1) / count;
        // Integrate the swept segment, including fast movement between frames.
        const samples = Math.max(1, Math.ceil(distance / count / 3));
        for (let k = 0; k < samples; k++) {
          const t = a + (b - a) * (k + .5) / samples;
          this.disturb(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t,
            force * this.pressure * h / samples * (1 + .055 * Math.sin(this.time * 9)));
        }
      }
      for (let y = 0; y < rows; y++) for (let x = 0; x < w; x++) {
        const i = y * w + x, z = field[i];
        // Reflecting boundary with mild edge damping: waves remain inside the button.
        const lap = field[y * w + Math.max(0, x - 1)] + field[y * w + Math.min(w - 1, x + 1)]
          + field[Math.max(0, y - 1) * w + x] + field[Math.min(rows - 1, y + 1) * w + x] - 4 * z;
        const edge = x < 2 || y < 2 || x >= w - 2 || y >= rows - 2;
        velocity[i] = (velocity[i] + (c2 * lap - z * 6) * h) * attenuation * (edge ? Math.exp(-h * 4) : 1);
      }
      for (let i = 0; i < field.length; i++) field[i] += velocity[i] * h;
    }
    this.previous = { ...to };
    let energy = 0;
    for (let i = 0; i < field.length; i++) energy += field[i] ** 2 + velocity[i] ** 2 * .01;
    this.energy = energy / field.length;
    if (!this.active) { this.clear(); return; }
    this.draw();
  }
  seek(progress) {
    this.clear(); this.pulse();
    for (let i = 0; i < Math.round(progress * 180); i++) this.step(1 / 60);
    this.draw();
  }
  clear() {
    this.held = false; this.pressure = 0; this.energy = 0; this.time = 0;
    this.heightField.fill(0); this.velocity.fill(0);
    this.previous = { ...this.point };
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.drawRefraction(true);
  }
  draw() {
    if (!this.pixels || !this.light) return;
    const w = this.cols, rows = this.rows, field = this.heightField, data = this.pixels.data;
    let p = 0;
    for (let y = 0; y < rows; y++) for (let x = 0; x < w; x++) {
      const nx = field[y * w + Math.min(w - 1, x + 1)] - field[y * w + Math.max(0, x - 1)];
      const ny = field[Math.min(rows - 1, y + 1) * w + x] - field[Math.max(0, y - 1) * w + x];
      // Broader specular shoulders and stronger opposing shade reveal depth
      // without changing the wave field, drag forces or propagation speed.
      const light = Math.tanh((-nx * .72 - ny * .95) * 6);
      const shoulder = Math.abs(light) ** .85;
      const glint = Math.max(0, light) ** 1.35;
      const color = light >= 0 ? this.light : this.shadow;
      data[p++] = color[0]; data[p++] = color[1]; data[p++] = color[2];
      const depth = this.variant === 'a' ? .85 : 1;
      data[p++] = Math.round(255 * depth * Math.min(.82, light >= 0 ? shoulder * .6 + glint * .45 : shoulder * .55));
    }
    this.lightContext.putImageData(this.pixels, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.drawImage(this.lightMap, 0, 0, this.canvas.width, this.canvas.height);
    this.drawRefraction();
  }
  destroy() {
    this.clear(); this.canvas.remove();
    const r = this.refraction;
    if (r) {
      if (r.target.style.filter.includes(r.id)) {
        if (r.original) r.target.style.setProperty('filter', r.original, r.priority);
        else r.target.style.removeProperty('filter');
      }
      r.defs.remove(); this.refraction = null;
    }
  }
}
