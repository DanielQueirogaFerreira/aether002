/** Local 0–1 anatomy parts. The field places them as large, temporary glimpses. */

export type Cloud = {
  x: Float32Array;
  y: Float32Array;
  tx: Float32Array;
  ty: Float32Array;
  n: number;
};

type Sample = { x: number; y: number; tx: number; ty: number };

export type Part = {
  id: string;
  points: Sample[];
};

function tangent(ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax;
  const dy = by - ay;
  const d = Math.hypot(dx, dy) || 1;
  return { tx: dx / d, ty: dy / d };
}

function fillEllipse(cx: number, cy: number, rx: number, ry: number, n: number): Sample[] {
  const out: Sample[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = Math.sqrt((i * 0.618033) % 1);
    out.push({
      x: cx + Math.cos(a) * rx * r,
      y: cy + Math.sin(a) * ry * r,
      tx: -Math.sin(a) * 0.3,
      ty: Math.cos(a) * 0.3,
    });
  }
  return out;
}

function fillCapsule(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  r: number,
  n: number,
): Sample[] {
  const tan = tangent(x1, y1, x2, y2);
  const px = -tan.ty;
  const py = tan.tx;
  const out: Sample[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i + 0.35) / n;
    const rad = r * Math.sqrt((i * 0.37) % 1);
    const sign = i % 2 === 0 ? 1 : -1;
    out.push({
      x: x1 + (x2 - x1) * t + px * rad * sign,
      y: y1 + (y2 - y1) * t + py * rad * sign,
      tx: tan.tx,
      ty: tan.ty,
    });
  }
  return out;
}

function mirrorX(points: Sample[]): Sample[] {
  return points.map((s) => ({ x: 1 - s.x, y: s.y, tx: -s.tx, ty: s.ty }));
}

function pack(samples: Sample[]): Cloud {
  const n = samples.length;
  const x = new Float32Array(n);
  const y = new Float32Array(n);
  const tx = new Float32Array(n);
  const ty = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    x[i] = samples[i].x;
    y[i] = samples[i].y;
    tx[i] = samples[i].tx;
    ty[i] = samples[i].ty;
  }
  return { x, y, tx, ty, n };
}

const head = () => fillEllipse(0.5, 0.11, 0.11, 0.095, 240);
const chest = () => fillEllipse(0.5, 0.32, 0.18, 0.11, 280);
const belly = () => fillEllipse(0.5, 0.45, 0.13, 0.09, 160);
const pelvis = () => fillEllipse(0.5, 0.54, 0.155, 0.07, 140);
const rArm = () => [
  ...fillCapsule(0.68, 0.27, 0.82, 0.46, 0.032, 200),
  ...fillCapsule(0.82, 0.46, 0.9, 0.62, 0.026, 180),
  ...fillEllipse(0.91, 0.64, 0.038, 0.032, 56),
];
const rLeg = () => [
  ...fillCapsule(0.58, 0.57, 0.61, 0.78, 0.052, 220),
  ...fillCapsule(0.61, 0.78, 0.59, 0.95, 0.036, 180),
  ...fillEllipse(0.62, 0.97, 0.065, 0.024, 48),
];

export function figureParts(): Part[] {
  const arm = rArm();
  const leg = rLeg();
  return [
    { id: "head", points: head() },
    { id: "chest", points: [...chest(), ...belly()] },
    { id: "arm", points: arm },
    { id: "arm-l", points: mirrorX(arm) },
    { id: "pelvis", points: pelvis() },
    { id: "leg", points: leg },
    { id: "leg-l", points: mirrorX(leg) },
    {
      id: "body",
      points: [
        ...head(),
        ...fillCapsule(0.5, 0.2, 0.5, 0.24, 0.04, 40),
        ...chest(),
        ...belly(),
        ...pelvis(),
        ...arm,
        ...mirrorX(arm),
        ...leg,
        ...mirrorX(leg),
      ],
    },
  ];
}

export function nerveParts(): Part[] {
  const brain = [
    ...fillEllipse(0.5, 0.11, 0.125, 0.1, 220),
    ...fillEllipse(0.5, 0.105, 0.07, 0.055, 80),
    ...fillEllipse(0.46, 0.1, 0.04, 0.045, 40),
    ...fillEllipse(0.54, 0.1, 0.04, 0.045, 40),
  ];
  const spine = fillCapsule(0.5, 0.2, 0.5, 0.56, 0.028, 200);
  const rArmN = [
    ...fillCapsule(0.5, 0.25, 0.68, 0.28, 0.022, 70),
    ...fillCapsule(0.68, 0.28, 0.82, 0.45, 0.02, 110),
    ...fillCapsule(0.7, 0.3, 0.86, 0.58, 0.016, 90),
    ...fillCapsule(0.66, 0.32, 0.8, 0.56, 0.014, 70),
  ];
  const rChest = [
    ...fillCapsule(0.5, 0.3, 0.64, 0.31, 0.016, 40),
    ...fillCapsule(0.5, 0.35, 0.65, 0.36, 0.016, 40),
    ...fillCapsule(0.5, 0.4, 0.63, 0.42, 0.016, 40),
    ...fillCapsule(0.5, 0.45, 0.6, 0.47, 0.016, 36),
  ];
  const rLegN = [
    ...fillCapsule(0.5, 0.54, 0.6, 0.6, 0.022, 50),
    ...fillCapsule(0.58, 0.58, 0.62, 0.8, 0.024, 130),
    ...fillCapsule(0.62, 0.8, 0.6, 0.96, 0.018, 90),
    ...fillCapsule(0.6, 0.78, 0.67, 0.95, 0.014, 60),
  ];
  return [
    { id: "brain", points: brain },
    { id: "spine", points: [...brain.slice(0, 40), ...spine] },
    { id: "arm", points: rArmN },
    { id: "arm-l", points: mirrorX(rArmN) },
    { id: "chest", points: [...rChest, ...mirrorX(rChest), ...spine.slice(40, 120)] },
    { id: "leg", points: rLegN },
    { id: "leg-l", points: mirrorX(rLegN) },
    {
      id: "whole",
      points: [
        ...brain,
        ...spine,
        ...rArmN,
        ...mirrorX(rArmN),
        ...rChest,
        ...mirrorX(rChest),
        ...rLegN,
        ...mirrorX(rLegN),
      ],
    },
  ];
}

export type PlaceSpec = {
  cover: number;
  cx: number;
  cy: number;
  flip: boolean;
  rot: number;
};

export function placePart(points: Sample[], w: number, h: number, spec: PlaceSpec): Cloud {
  let minx = 1;
  let miny = 1;
  let maxx = 0;
  let maxy = 0;
  for (const p of points) {
    minx = Math.min(minx, p.x);
    miny = Math.min(miny, p.y);
    maxx = Math.max(maxx, p.x);
    maxy = Math.max(maxy, p.y);
  }
  const bw = Math.max(0.04, maxx - minx);
  const bh = Math.max(0.04, maxy - miny);
  const pcx = (minx + maxx) * 0.5;
  const pcy = (miny + maxy) * 0.5;
  const target = Math.min(w, h) * spec.cover;
  const s = target / Math.max(bw, bh);
  const cos = Math.cos(spec.rot);
  const sin = Math.sin(spec.rot);
  const out: Sample[] = [];
  for (const p of points) {
    let lx = (p.x - pcx) * (spec.flip ? -1 : 1);
    let ly = p.y - pcy;
    const rx = lx * cos - ly * sin;
    const ry = lx * sin + ly * cos;
    out.push({
      x: spec.cx + rx * s,
      y: spec.cy + ry * s,
      tx: spec.flip ? -p.tx : p.tx,
      ty: p.ty,
    });
  }
  return pack(out);
}

export function isAnatomy(mode: string) {
  return mode === "figure" || mode === "nerve";
}
