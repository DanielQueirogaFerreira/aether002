import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  MODES,
  PALETTES,
  type CycleMode,
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
  cycle: CycleMode;
  cycleSec: number;
  sequence: PaletteId[];
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
  setCycle: (cycle: CycleMode) => void;
  setCycleSec: (n: number) => void;
  toggleSequence: (id: PaletteId) => void;
  pinHash: string;
  lockEnterFs: boolean;
  lockExitFs: boolean;
  lockHide: boolean;
  lockShow: boolean;
  setPin: (pin: string) => void;
  clearPin: () => void;
  setLock: (
    key: "lockEnterFs" | "lockExitFs" | "lockHide" | "lockShow",
    on: boolean,
  ) => void;
  setFreePanel: () => void;
  setLockAll: () => void;
  pinOk: (pin: string) => boolean;
  addShot: (shot: Snapshot) => void;
  removeShot: (id: string) => void;
  config: () => FieldConfig;
};

function paletteById(id: PaletteId) {
  return PALETTES.find((p) => p.id === id) ?? PALETTES[0];
}

export function hashPin(pin: string) {
  let h = 2166136261;
  const s = `aether-kiosk:${pin}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
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
      cycle: "hold",
      cycleSec: 20,
      sequence: PALETTES.map((p) => p.id),
      pinHash: "",
      lockEnterFs: false,
      lockExitFs: false,
      lockHide: false,
      lockShow: false,
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
      setCycle: (cycle) => set({ cycle }),
      setCycleSec: (cycleSec) => set({ cycleSec: Math.max(5, Math.min(120, cycleSec)) }),
      toggleSequence: (id) => {
        const seq = get().sequence;
        if (seq.includes(id)) {
          if (seq.length <= 1) return;
          set({ sequence: seq.filter((x) => x !== id) });
        } else if (seq.length < 8) {
          set({ sequence: [...seq, id] });
        }
      },
      setPin: (pin) => set({ pinHash: hashPin(pin) }),
      clearPin: () =>
        set({
          pinHash: "",
          lockEnterFs: false,
          lockExitFs: false,
          lockHide: false,
          lockShow: false,
        }),
      setLock: (key, on) => {
        if (on && !get().pinHash) return;
        set({ [key]: on });
      },
      setFreePanel: () =>
        set({
          lockEnterFs: false,
          lockExitFs: false,
          lockHide: false,
          lockShow: false,
        }),
      setLockAll: () => {
        if (!get().pinHash) return;
        set({
          lockEnterFs: true,
          lockExitFs: true,
          lockHide: true,
          lockShow: true,
        });
      },
      pinOk: (pin) => Boolean(get().pinHash) && get().pinHash === hashPin(pin),
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
        cycle: s.cycle,
        cycleSec: s.cycleSec,
        sequence: s.sequence,
        pinHash: s.pinHash,
        lockEnterFs: s.lockEnterFs,
        lockExitFs: s.lockExitFs,
        lockHide: s.lockHide,
        lockShow: s.lockShow,
        shots: s.shots,
      }),
    },
  ),
);
