export type Mode =
  | "drift"
  | "orbit"
  | "weave"
  | "ember"
  | "tide"
  | "figure"
  | "nerve";

export type PaletteId =
  | "polar"
  | "ember"
  | "ink"
  | "moss"
  | "dusk"
  | "flare"
  | "volt"
  | "solar";

export type Palette = {
  id: PaletteId;
  label: string;
  colors: [string, string, string, string];
};

export type Snapshot = {
  id: string;
  src: string;
  mode: Mode;
  palette: PaletteId;
  at: number;
};

export type SoundSource = "aether" | "field" | "custom";

export type FieldConfig = {
  mode: Mode;
  palette: Palette;
  density: number;
  flow: number;
  trail: number;
  paused: boolean;
};

export const MODES: { id: Mode; label: string; hint: string }[] = [
  { id: "drift", label: "Drift", hint: "A slow wind through the field" },
  { id: "orbit", label: "Orbit", hint: "Circles whatever you touch" },
  { id: "weave", label: "Weave", hint: "Threads find each other" },
  { id: "ember", label: "Ember", hint: "Sparks lift and fade" },
  { id: "tide", label: "Tide", hint: "The whole room rolls" },
  { id: "figure", label: "Form", hint: "A body gathers in the pool, then lets go" },
  { id: "nerve", label: "Nerve", hint: "A cord remembered, then forgotten" },
];

export const PALETTES: Palette[] = [
  {
    id: "polar",
    label: "Polar",
    colors: ["#f4f7fb", "#c5d4e0", "#8aa0b4", "#5c7388"],
  },
  {
    id: "ember",
    label: "Ember",
    colors: ["#f6efe6", "#e0c4a4", "#c4845a", "#8a4a32"],
  },
  {
    id: "ink",
    label: "Ink",
    colors: ["#e8eef6", "#9eb0c8", "#5d738c", "#314155"],
  },
  {
    id: "moss",
    label: "Moss",
    colors: ["#eaf0e6", "#b4c4aa", "#6e8b6e", "#3d5444"],
  },
  {
    id: "dusk",
    label: "Dusk",
    colors: ["#f0ebe8", "#c9b8b4", "#8e7a7a", "#4a4048"],
  },
  {
    id: "flare",
    label: "Flare",
    colors: ["#ffd4cc", "#ff4d3a", "#e11d1d", "#9b0c0c"],
  },
  {
    id: "volt",
    label: "Volt",
    colors: ["#cce6ff", "#3b9eff", "#1d6fe8", "#1240a8"],
  },
  {
    id: "solar",
    label: "Solar",
    colors: ["#ffe0c2", "#ff8c2a", "#f05a00", "#b33a00"],
  },
];
