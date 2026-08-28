import { chimeSound } from "./audio";
import {
  figureParts,
  isAnatomy,
  nerveParts,
  placePart,
  type Cloud,
} from "./anatomy";
import type { FieldConfig, Mode, Palette } from "./types";

type Pointer = {
  x: number;
  y: number;
  down: boolean;
  active: boolean;
};

function hash(x: number, y: number) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

function noise(x: number, y: number) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy);
  const b = hash(ix + 1, iy);
  const c = hash(ix, iy + 1);
  const d = hash(ix + 1, iy + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function makeSprite(rgb: [number, number, number], size = 48) {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const g = c.getContext("2d")!;
  const r = size / 2;
  const grad = g.createRadialGradient(r, r, 0, r, r, r);
  const [cr, cg, cb] = rgb;
  grad.addColorStop(0, `rgba(${cr},${cg},${cb},0.95)`);
  grad.addColorStop(0.22, `rgba(${cr},${cg},${cb},0.42)`);
  grad.addColorStop(0.55, `rgba(${cr},${cg},${cb},0.1)`);
  grad.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return c;
}

function countForDensity(density: number, area: number, mobile: boolean, anatomy: boolean) {
  const t = density / 100;
  const base = mobile ? 280 + t * 700 : 520 + t * 1600;
  const areaScale = Math.min(1.25, Math.max(0.7, area / (1280 * 720)));
  return Math.floor(base * areaScale * (anatomy ? 1.2 : 1));
}

export class LightField {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private buf: HTMLCanvasElement;
  private bctx: CanvasRenderingContext2D;
  private w = 1;
  private h = 1;
  private dpr = 1;
  private n = 0;
  private x = new Float32Array(0);
  private y = new Float32Array(0);
  private vx = new Float32Array(0);
  private vy = new Float32Array(0);
  private life = new Float32Array(0);
  private maxLife = new Float32Array(0);
  private size = new Float32Array(0);
  private ci = new Uint8Array(0);
  private ti = new Uint32Array(0);
  private inG = new Uint8Array(0);
  private glimpse: Cloud | null = null;
  private glimpsePhase: "wait" | "in" | "hold" | "out" = "wait";
  private glimpseT = 0;
  private glimpseDur = 2.8;
  private glimpseStrength = 0;
  private lastPart = "";
  private sprites: HTMLCanvasElement[] = [];
  private palette: Palette | null = null;
  private fromRgb: [number, number, number][] = [];
  private toRgb: [number, number, number][] = [];
  private paletteMix = 1;
  private mode: Mode = "drift";
  private density = 62;
  private flow = 0.9;
  private trail = 0.06;
  private paused = false;
  private pointer: Pointer = { x: 0, y: 0, down: false, active: false };
  private t = 0;
  private raf = 0;
  private last = 0;
  private running = false;
  private energy = 0;
  private grid: number[][] = [];
  private cols = 0;
  private rows = 0;
  private cell = 56;
  onEnergy?: (energy: number, dt: number) => void;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("Canvas 2D unavailable");
    this.ctx = ctx;
    this.buf = document.createElement("canvas");
    const bctx = this.buf.getContext("2d", { alpha: false });
    if (!bctx) throw new Error("Offscreen canvas unavailable");
    this.bctx = bctx;
  }

  setConfig(cfg: FieldConfig) {
    const next = cfg.mode;
    const switched = next !== this.mode;
    this.mode = next;
    this.density = cfg.density;
    this.flow = 0.35 + (cfg.flow / 100) * 1.45;
    this.trail = 0.14 - (cfg.trail / 100) * 0.12;
    this.paused = cfg.paused;
    if (!this.palette || this.palette.id !== cfg.palette.id) {
      const nextRgb = cfg.palette.colors.map(hexToRgb);
      if (this.toRgb.length) {
        const t = this.paletteMix;
        this.fromRgb = this.toRgb.map((c, i) => {
          const a = this.fromRgb[i] ?? c;
          return [
            a[0] + (c[0] - a[0]) * t,
            a[1] + (c[1] - a[1]) * t,
            a[2] + (c[2] - a[2]) * t,
          ];
        });
      } else {
        this.fromRgb = nextRgb.map((c) => [...c] as [number, number, number]);
      }
      this.toRgb = nextRgb;
      this.paletteMix = this.palette ? 0 : 1;
      this.palette = cfg.palette;
      this.sprites = (this.paletteMix >= 1 ? nextRgb : this.fromRgb).map((rgb) =>
        makeSprite(rgb),
      );
    }
    this.ensureCount();
    if (switched) {
      this.glimpse = null;
      this.glimpseStrength = 0;
      this.lastPart = "";
      if (isAnatomy(next)) {
        this.glimpsePhase = "wait";
        this.glimpseT = 0;
        this.glimpseDur = 1.15 + Math.random() * 0.9;
      }
    }
  }

  setPointer(x: number, y: number, down: boolean, active: boolean) {
    this.pointer = { x, y, down, active };
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.floor(rect.width));
    const h = Math.max(1, Math.floor(rect.height));
    if (w === this.w && h === this.h && dpr === this.dpr) return;
    this.w = w;
    this.h = h;
    this.dpr = dpr;
    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    this.buf.width = this.canvas.width;
    this.buf.height = this.canvas.height;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.bctx.fillStyle = "#09090b";
    this.bctx.fillRect(0, 0, w, h);
    this.ensureCount(true);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = 0;
    const loop = (now: number) => {
      if (!this.running) return;
      const raw = this.last ? (now - this.last) / 1000 : 1 / 60;
      this.last = now;
      const dt = Math.min(raw, 0.05);
      this.step(dt);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  dispose() {
    this.stop();
  }

  reset() {
    this.seedAll();
    this.bctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.bctx.globalCompositeOperation = "source-over";
    this.bctx.fillStyle = "#09090b";
    this.bctx.fillRect(0, 0, this.w, this.h);
  }

  snapshotThumb(width = 360): string {
    const height = Math.max(1, Math.round((width * this.h) / this.w));
    const out = document.createElement("canvas");
    out.width = width;
    out.height = height;
    const o = out.getContext("2d")!;
    o.fillStyle = "#09090b";
    o.fillRect(0, 0, width, height);
    o.drawImage(this.canvas, 0, 0, width, height);
    return out.toDataURL("image/jpeg", 0.62);
  }

  exportPng(): string {
    const out = document.createElement("canvas");
    out.width = this.canvas.width;
    out.height = this.canvas.height;
    const o = out.getContext("2d")!;
    o.fillStyle = "#09090b";
    o.fillRect(0, 0, out.width, out.height);
    o.drawImage(this.canvas, 0, 0);
    return out.toDataURL("image/png");
  }

  private ensureCount(force = false) {
    const mobile = this.w < 720;
    const next = countForDensity(
      this.density,
      this.w * this.h,
      mobile,
      isAnatomy(this.mode),
    );
    if (!force && next === this.n) return;
    const prevN = this.n;
    const ox = this.x;
    const oy = this.y;
    const ovx = this.vx;
    const ovy = this.vy;
    const ol = this.life;
    const oml = this.maxLife;
    const os = this.size;
    const oci = this.ci;
    const oti = this.ti;
    const og = this.inG;
    this.n = next;
    this.x = new Float32Array(next);
    this.y = new Float32Array(next);
    this.vx = new Float32Array(next);
    this.vy = new Float32Array(next);
    this.life = new Float32Array(next);
    this.maxLife = new Float32Array(next);
    this.size = new Float32Array(next);
    this.ci = new Uint8Array(next);
    this.ti = new Uint32Array(next);
    this.inG = new Uint8Array(next);
    const copy = Math.min(prevN, next);
    this.x.set(ox.subarray(0, copy));
    this.y.set(oy.subarray(0, copy));
    this.vx.set(ovx.subarray(0, copy));
    this.vy.set(ovy.subarray(0, copy));
    this.life.set(ol.subarray(0, copy));
    this.maxLife.set(oml.subarray(0, copy));
    this.size.set(os.subarray(0, copy));
    this.ci.set(oci.subarray(0, copy));
    this.ti.set(oti.subarray(0, copy));
    this.inG.set(og.subarray(0, copy));
    for (let i = copy; i < next; i++) this.spawn(i, true);
  }

  private seedAll() {
    for (let i = 0; i < this.n; i++) this.spawn(i, true);
  }

  private spawn(i: number, anywhere: boolean) {
    const p = this.pointer;
    const near =
      !anywhere && (p.down || this.mode === "ember") && (p.active || p.down);
    if (near) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * (p.down ? 28 : 90);
      this.x[i] = p.x + Math.cos(a) * r;
      this.y[i] = p.y + Math.sin(a) * r;
    } else if (this.mode === "ember") {
      this.x[i] = Math.random() * this.w;
      this.y[i] = this.h + Math.random() * 40;
    } else {
      this.x[i] = Math.random() * this.w;
      this.y[i] = Math.random() * this.h;
    }
    this.vx[i] = (Math.random() - 0.5) * 20;
    this.vy[i] = (Math.random() - 0.5) * 20;
    const life = 2.4 + Math.random() * 5.5;
    this.maxLife[i] = life;
    this.life[i] = life * (anywhere ? Math.random() : 1);
    this.size[i] = 4 + Math.random() * 10;
    this.ci[i] = (Math.random() * 4) | 0;
    if (this.inG.length > i) this.inG[i] = 0;
  }

  private smooth(t: number) {
    const x = Math.max(0, Math.min(1, t));
    return x * x * (3 - 2 * x);
  }

  private tickGlimpse(dt: number) {
    if (!isAnatomy(this.mode) || this.w <= 1) {
      this.glimpseStrength = 0;
      return;
    }
    this.glimpseT += dt;
    if (this.glimpsePhase === "wait") {
      this.glimpseStrength = 0;
      if (this.glimpseT >= this.glimpseDur) this.beginGlimpse();
      return;
    }
    if (this.glimpsePhase === "in") {
      this.glimpseStrength = this.smooth(this.glimpseT / this.glimpseDur);
      if (this.glimpseT >= this.glimpseDur) {
        this.glimpsePhase = "hold";
        this.glimpseT = 0;
        this.glimpseDur = 2.1 + Math.random() * 2.4;
      }
      return;
    }
    if (this.glimpsePhase === "hold") {
      this.glimpseStrength = 1;
      if (this.glimpseT >= this.glimpseDur) {
        this.glimpsePhase = "out";
        this.glimpseT = 0;
        this.glimpseDur = 1.8 + Math.random() * 1.6;
      }
      return;
    }
    this.glimpseStrength = 1 - this.smooth(this.glimpseT / this.glimpseDur);
    if (this.glimpseT >= this.glimpseDur) {
      this.glimpse = null;
      this.glimpseStrength = 0;
      this.glimpsePhase = "wait";
      this.glimpseT = 0;
      this.glimpseDur = 2.4 + Math.random() * 3.4;
      this.inG.fill(0);
    }
  }

  private beginGlimpse() {
    const parts = this.mode === "nerve" ? nerveParts() : figureParts();
    let pick = parts[(Math.random() * parts.length) | 0];
    if (!pick) return;
    if (pick.id === this.lastPart && parts.length > 1) {
      pick = parts[(Math.random() * parts.length) | 0] ?? pick;
    }
    if ((pick.id === "body" || pick.id === "whole") && Math.random() > 0.28) {
      const rest = parts.filter((p) => p.id !== "body" && p.id !== "whole");
      pick = rest[(Math.random() * rest.length) | 0] ?? pick;
    }
    this.lastPart = pick.id;
    const big = pick.id === "body" || pick.id === "whole";
    const cover = big
      ? 0.78 + Math.random() * 0.28
      : pick.id === "head" || pick.id === "brain"
        ? 0.42 + Math.random() * 0.28
        : 0.58 + Math.random() * 0.38;
    const cloud = placePart(pick.points, this.w, this.h, {
      cover,
      cx: this.w * (0.28 + Math.random() * 0.44),
      cy: this.h * (0.3 + Math.random() * 0.4),
      flip: Math.random() < 0.5,
      rot: (Math.random() - 0.5) * 0.44,
    });
    this.glimpse = cloud;
    const reach = Math.min(this.w, this.h) * (big ? 0.42 : 0.2);
    const reach2 = reach * reach;
    for (let i = 0; i < this.n; i++) {
      let best = 0;
      let bestD = 1e12;
      for (let k = 0; k < cloud.n; k += 3) {
        const dx = this.x[i] - cloud.x[k];
        const dy = this.y[i] - cloud.y[k];
        const d2 = dx * dx + dy * dy;
        if (d2 < bestD) {
          bestD = d2;
          best = k;
        }
      }
      if (bestD < reach2 && Math.random() < (big ? 0.78 : 0.7)) {
        this.inG[i] = 1;
        this.ti[i] = best;
      } else {
        this.inG[i] = 0;
      }
    }
    this.glimpsePhase = "in";
    this.glimpseT = 0;
    this.glimpseDur = 1.35 + Math.random() * 0.8;
    chimeSound(this.mode === "nerve" ? "nerve" : "figure");
  }

  private attractor(): { x: number; y: number; down: boolean; active: boolean } {
    if (this.pointer.active) {
      return {
        x: this.pointer.x,
        y: this.pointer.y,
        down: this.pointer.down,
        active: true,
      };
    }
    return {
      x: this.w * 0.5 + Math.cos(this.t * 0.33) * this.w * 0.28,
      y: this.h * 0.5 + Math.sin(this.t * 0.24) * this.h * 0.2,
      down: false,
      active: false,
    };
  }

  private step(dt: number) {
    this.resize();
    if (this.paletteMix < 1 && this.toRgb.length) {
      this.paletteMix = Math.min(1, this.paletteMix + dt / 1.5);
      const t = this.paletteMix;
      this.sprites = this.toRgb.map((c, i) => {
        const a = this.fromRgb[i] ?? c;
        return makeSprite([
          a[0] + (c[0] - a[0]) * t,
          a[1] + (c[1] - a[1]) * t,
          a[2] + (c[2] - a[2]) * t,
        ]);
      });
    }
    if (this.paused) {
      this.blit();
      return;
    }
    this.t += dt;
    this.tickGlimpse(dt);
    const mode = this.mode;
    const at = this.attractor();
    const flow = this.flow;
    let energy = 0;
    const pts = this.glimpse;
    const g = this.glimpseStrength;

    for (let i = 0; i < this.n; i++) {
      let x = this.x[i];
      let y = this.y[i];
      let vx = this.vx[i];
      let vy = this.vy[i];
      const dx = at.x - x;
      const dy = at.y - y;
      const d2 = dx * dx + dy * dy;
      const d = Math.sqrt(d2) + 0.001;

      if (mode === "figure" || mode === "nerve" || mode === "drift") {
        const n1 = noise(x * 0.0022, y * 0.0022 + this.t * 0.07);
        const ang = n1 * Math.PI * 4;
        const pool =
          (mode === "nerve" ? 0.78 : 1) * (1 - g * (this.inG[i] ? 0.62 : 0.12));
        vx += Math.cos(ang) * 70 * flow * pool * dt;
        vy += Math.sin(ang) * 70 * flow * pool * dt;
        const swirl = ((at.down ? 420 : 160) / d) * (at.active ? 1 : 0.85);
        vx += (-dy / d) * swirl * dt;
        vy += (dx / d) * swirl * dt;
        if (mode === "nerve") {
          const n2 = noise(x * 0.0015 + 9, y * 0.0015);
          vx += Math.cos(n2 * Math.PI * 2) * 22 * flow * dt;
          vy += Math.sin(n2 * Math.PI * 2) * 22 * flow * dt;
        }
        if (g > 0.02 && this.inG[i] && pts && pts.n) {
          const k = this.ti[i] % pts.n;
          const spring = (mode === "nerve" ? 12.5 : 11) * g * flow;
          vx += (pts.x[k] - x) * spring * dt;
          vy += (pts.y[k] - y) * spring * dt;
          vx += pts.tx[k] * 14 * g * flow * dt;
          vy += pts.ty[k] * 14 * g * flow * dt;
        }
      } else if (mode === "orbit") {
        const pull = at.down ? 0.9 : 0.35;
        vx += (-dy / d) * 140 * flow * dt - dx * pull * dt;
        vy += (dx / d) * 140 * flow * dt - dy * pull * dt;
      } else if (mode === "weave") {
        const n1 = noise(x * 0.0016 + 8, y * 0.0016);
        const ang = n1 * Math.PI * 2;
        vx += Math.cos(ang) * 36 * flow * dt;
        vy += Math.sin(ang) * 36 * flow * dt;
        vx += dx * 0.08 * dt;
        vy += dy * 0.08 * dt;
      } else if (mode === "ember") {
        vy -= (70 + flow * 50) * dt;
        vx += (noise(x * 0.01, this.t * 0.4) - 0.5) * 90 * dt;
        if (at.down && d < 140) {
          vx += (dx / d) * -40 * dt;
          vy -= 40 * dt;
        }
      } else {
        vx += Math.cos(y * 0.01 + this.t * 0.7) * 55 * flow * dt;
        vy += Math.sin(x * 0.008 + this.t * 0.55) * 28 * flow * dt;
        if (d < 180) {
          const k = (1 - d / 180) * (at.down ? 320 : 90);
          vx += (dx / d) * k * dt;
          vy += (dy / d) * k * dt;
        }
      }

      vx *= Math.max(0, 1 - 0.55 * dt);
      vy *= Math.max(0, 1 - 0.55 * dt);
      const sp = Math.hypot(vx, vy);
      const cap = 220;
      if (sp > cap) {
        vx = (vx / sp) * cap;
        vy = (vy / sp) * cap;
      }
      x += vx * dt;
      y += vy * dt;
      this.life[i] -= dt;

      const m = 40;
      if (x < -m || x > this.w + m || y < -m || y > this.h + m || this.life[i] <= 0) {
        this.spawn(i, false);
        continue;
      }
      this.x[i] = x;
      this.y[i] = y;
      this.vx[i] = vx;
      this.vy[i] = vy;
      energy += sp;
    }

    this.energy = this.n ? energy / this.n / 220 : 0;
    this.onEnergy?.(this.energy, dt);
    this.draw();
  }

  private draw() {
    const b = this.bctx;
    b.globalCompositeOperation = "source-over";
    b.fillStyle = `rgba(9,9,11,${this.trail})`;
    b.fillRect(0, 0, this.w, this.h);
    b.globalCompositeOperation = "lighter";
    if (this.mode === "weave") this.drawLinks(b);

    for (let i = 0; i < this.n; i++) {
      const sprite = this.sprites[this.ci[i] % this.sprites.length];
      if (!sprite) continue;
      const fade = Math.max(0.15, this.life[i] / this.maxLife[i]);
      const spd = Math.hypot(this.vx[i], this.vy[i]);
      const gathered = this.glimpseStrength * (this.inG[i] ? 1 : 0);
      const s =
        this.size[i] *
        (0.7 + fade * 0.6) *
        (0.85 + Math.min(spd / 180, 0.5)) *
        (1 + gathered * 0.18);
      b.globalAlpha = 0.22 + fade * 0.55 + gathered * 0.12;
      b.drawImage(sprite, this.x[i] - s, this.y[i] - s, s * 2, s * 2);
    }
    b.globalAlpha = 1;
    b.globalCompositeOperation = "source-over";
    this.blit();
  }

  private drawLinks(b: CanvasRenderingContext2D) {
    const cell = this.cell;
    const cols = Math.max(1, Math.ceil(this.w / cell));
    const rows = Math.max(1, Math.ceil(this.h / cell));
    if (this.cols !== cols || this.rows !== rows) {
      this.cols = cols;
      this.rows = rows;
      this.grid = Array.from({ length: cols * rows }, () => []);
    } else {
      for (const bucket of this.grid) bucket.length = 0;
    }
    for (let i = 0; i < this.n; i++) {
      const cx = Math.min(cols - 1, Math.max(0, (this.x[i] / cell) | 0));
      const cy = Math.min(rows - 1, Math.max(0, (this.y[i] / cell) | 0));
      this.grid[cy * cols + cx].push(i);
    }
    const maxD = 46;
    const maxD2 = maxD * maxD;
    b.lineWidth = 0.7;
    const rgb = this.palette ? hexToRgb(this.palette.colors[1]) : [197, 203, 214];
    for (let i = 0; i < this.n; i++) {
      const cx = Math.min(cols - 1, Math.max(0, (this.x[i] / cell) | 0));
      const cy = Math.min(rows - 1, Math.max(0, (this.y[i] / cell) | 0));
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          const nx = cx + ox;
          const ny = cy + oy;
          if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
          const bucket = this.grid[ny * cols + nx];
          for (const j of bucket) {
            if (j <= i) continue;
            const dx = this.x[i] - this.x[j];
            const dy = this.y[i] - this.y[j];
            const d2 = dx * dx + dy * dy;
            if (d2 > maxD2) continue;
            const a = (1 - d2 / maxD2) * (this.mode === "nerve" ? 0.38 : 0.22);
            b.strokeStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`;
            b.beginPath();
            b.moveTo(this.x[i], this.y[i]);
            b.lineTo(this.x[j], this.y[j]);
            b.stroke();
          }
        }
      }
    }
  }

  private blit() {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.drawImage(this.buf, 0, 0, this.w, this.h);
    const vg = ctx.createRadialGradient(
      this.w * 0.5,
      this.h * 0.5,
      Math.min(this.w, this.h) * 0.25,
      this.w * 0.5,
      this.h * 0.5,
      Math.max(this.w, this.h) * 0.72,
    );
    vg.addColorStop(0, "rgba(9,9,11,0)");
    vg.addColorStop(1, "rgba(9,9,11,0.55)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, this.w, this.h);
  }
}
