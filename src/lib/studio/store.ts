import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  MODES,
  PALETTES,
  type FieldConfig,
  type Mode,
  type PaletteId,
  type Snapshot,
  type SoundSource,
} from "./types";

const MAX_SHOTS = 8;

type StudioState = {
  started: boolean;
  mode: Mode;
  paletteId: PaletteId;
  density: number;
  flow: number;
  trail: number;
  paused: boolean;
  sound: boolean;
  volume: number;
  loop: boolean;
  sourceId: SoundSource;
  customName: string;
  chrome: boolean;
  panel: boolean;
  galleryOpen: boolean;
  shots: Snapshot[];
  start: () => void;
  setMode: (mode: Mode) => void;
  cycleMode: (dir: 1 | -1) => void;
  setPalette: (id: PaletteId) => void;
  setDensity: (n: number) => void;
  setFlow: (n: number) => void;
  setTrail: (n: number) => void;
  togglePaused: () => void;
  toggleSound: () => void;
  setVolume: (n: number) => void;
  setLoop: (on: boolean) => void;
  setSourceId: (id: SoundSource) => void;
  setCustomName: (name: string) => void;
  toggleChrome: () => void;
  togglePanel: () => void;
  setChrome: (chrome: boolean) => void;
  setPanel: (panel: boolean) => void;
  setGalleryOpen: (open: boolean) => void;
  addShot: (shot: Snapshot) => void;
  removeShot: (id: string) => void;
  config: () => FieldConfig;
};

function paletteById(id: PaletteId) {
  return PALETTES.find((p) => p.id === id) ?? PALETTES[0];
}

export const useStudio = create<StudioState>()(
  persist(
    (set, get) => ({
      started: false,
      mode: "drift",
      paletteId: "polar",
      density: 62,
      flow: 55,
      trail: 72,
      paused: false,
      sound: false,
      volume: 62,
      loop: true,
      sourceId: "aether",
      customName: "",
      chrome: true,
      panel: false,
      galleryOpen: false,
      shots: [],
      start: () => set({ started: true }),
      setMode: (mode) => set({ mode }),
      cycleMode: (dir) => {
        const i = MODES.findIndex((m) => m.id === get().mode);
        const next = MODES[(i + dir + MODES.length) % MODES.length];
        if (next) set({ mode: next.id });
      },
      setPalette: (paletteId) => set({ paletteId }),
      setDensity: (density) => set({ density }),
      setFlow: (flow) => set({ flow }),
      setTrail: (trail) => set({ trail }),
      togglePaused: () => set({ paused: !get().paused }),
      toggleSound: () => set({ sound: !get().sound }),
      setVolume: (volume) => set({ volume }),
      setLoop: (loop) => set({ loop }),
      setSourceId: (sourceId) => set({ sourceId }),
      setCustomName: (customName) => set({ customName, sourceId: "custom" }),
      toggleChrome: () => {
        const chrome = !get().chrome;
        set({ chrome, panel: chrome ? get().panel : false });
      },
      togglePanel: () => {
        const open = !get().panel;
        set({ panel: open, chrome: open ? true : get().chrome });
      },
      setChrome: (chrome) => set({ chrome, panel: chrome ? get().panel : false }),
      setPanel: (panel) => set({ panel, chrome: panel ? true : get().chrome }),
      setGalleryOpen: (galleryOpen) => set({ galleryOpen }),
      addShot: (shot) =>
        set({
          shots: [shot, ...get().shots].slice(0, MAX_SHOTS),
        }),
      removeShot: (id) =>
        set({ shots: get().shots.filter((s) => s.id !== id) }),
      config: () => {
        const s = get();
        return {
          mode: s.mode,
          palette: paletteById(s.paletteId),
          density: s.density,
          flow: s.flow,
          trail: s.trail,
          paused: s.paused,
        };
      },
    }),
    {
      name: "aether-studio-v1",
      partialize: (s) => ({
        mode: s.mode,
        paletteId: s.paletteId,
        density: s.density,
        flow: s.flow,
        trail: s.trail,
        sound: s.sound,
        volume: s.volume,
        loop: s.loop,
        sourceId: s.sourceId === "custom" ? "aether" : s.sourceId,
        shots: s.shots,
      }),
    },
  ),
);
