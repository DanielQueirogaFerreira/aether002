import { useEffect, useRef, useState } from "react";
import {
  Camera,
  Download,
  Eye,
  EyeOff,
  ImageIcon,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  Repeat,
  Repeat1,
  RotateCcw,
  SlidersHorizontal,
  Upload,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { toast, Toaster } from "sonner";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { LightField } from "@/lib/studio/engine";
import {
  loadCustomSound,
  pulseSound,
  resumeSound,
  setSoundEnabled,
  setSoundLoop,
  setSoundMode,
  setSoundSource,
  setSoundVolume,
} from "@/lib/studio/audio";
import { useStudio } from "@/lib/studio/store";
import { MODES, PALETTES, type CycleMode, type Mode, type PaletteId } from "@/lib/studio/types";
import { cn } from "@/lib/utils";

export function Studio() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fieldRef = useRef<LightField | null>(null);
  const [flash, setFlash] = useState(false);
  const [cinema, setCinema] = useState(false);
  const wakeRef = useRef<WakeLockSentinel | null>(null);

  const started = useStudio((s) => s.started);
  const chrome = useStudio((s) => s.chrome);
  const galleryOpen = useStudio((s) => s.galleryOpen);
  const cycle = useStudio((s) => s.cycle);
  const cycleSec = useStudio((s) => s.cycleSec);
  const sequenceKey = useStudio((s) => s.sequence.join(","));

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const field = new LightField(el);
    fieldRef.current = field;
    field.setConfig(useStudio.getState().config());
    field.onEnergy = (energy, dt) => pulseSound(energy, dt);
    field.start();
    const unsub = useStudio.subscribe((s) => {
      field.setConfig(s.config());
    });
    return () => {
      unsub();
      field.dispose();
      fieldRef.current = null;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      const st = useStudio.getState();
      if (!st.started) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          st.start();
        }
        return;
      }
      if (e.key === "Escape") {
        st.setGalleryOpen(false);
        if (st.panel) st.togglePanel();
        return;
      }
      if (e.key === " ") {
        e.preventDefault();
        st.togglePaused();
        return;
      }
      const map: Record<string, Mode> = {
        "1": "drift",
        "2": "orbit",
        "3": "weave",
        "4": "ember",
        "5": "tide",
        "6": "figure",
        "7": "nerve",
      };
      if (map[e.key]) {
        st.setMode(map[e.key]);
        return;
      }
      if (e.key === "[" || e.key === "ArrowLeft") st.cycleMode(-1);
      if (e.key === "]" || e.key === "ArrowRight") st.cycleMode(1);
      if (e.key === "h" || e.key === "H") st.toggleChrome();
      if (e.key === "m" || e.key === "M") st.toggleSound();
      if (e.key === "g" || e.key === "G") st.setGalleryOpen(!st.galleryOpen);
      if (e.key === "r" || e.key === "R") fieldRef.current?.reset();
      if (e.key === "s" || e.key === "S") capture();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const s = useStudio.getState();
    setSoundEnabled(s.sound);
    setSoundMode(s.mode);
    setSoundVolume(s.volume);
    setSoundLoop(s.loop);
    setSoundSource(s.sourceId === "custom" ? "aether" : s.sourceId);
    return useStudio.subscribe((n, p) => {
      if (n.sound !== p.sound) setSoundEnabled(n.sound);
      if (n.mode !== p.mode) setSoundMode(n.mode);
      if (n.volume !== p.volume) setSoundVolume(n.volume);
      if (n.loop !== p.loop) setSoundLoop(n.loop);
      if (n.sourceId !== p.sourceId && n.sourceId !== "custom") setSoundSource(n.sourceId);
    });
  }, []);

  useEffect(() => {
    const onFs = () => {
      const on = Boolean(document.fullscreenElement);
      setCinema(on);
      if (!on) {
        void wakeRef.current?.release().catch(() => {});
        wakeRef.current = null;
      }
    };
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  useEffect(() => {
    if (!cinema) {
      void wakeRef.current?.release().catch(() => {});
      wakeRef.current = null;
      return;
    }
    const grab = async () => {
      try {
        if ("wakeLock" in navigator && document.visibilityState === "visible") {
          wakeRef.current = await navigator.wakeLock.request("screen");
        }
      } catch {
        /* iOS / policy */
      }
    };
    void grab();
    const onVis = () => {
      if (document.visibilityState === "visible") void grab();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [cinema]);

  useEffect(() => {
    if (cycle === "hold") return;
    const tick = () => {
      const s = useStudio.getState();
      if (s.cycle === "hold" || !s.started) return;
      if (s.cycle === "random") {
        const pool = PALETTES.filter((p) => p.id !== s.paletteId);
        const pick = pool[Math.floor(Math.random() * pool.length)];
        if (pick) s.setPalette(pick.id);
        return;
      }
      const seq = s.sequence.length ? s.sequence : PALETTES.map((p) => p.id);
      const i = Math.max(0, seq.indexOf(s.paletteId));
      s.setPalette(seq[(i + 1) % seq.length] ?? seq[0]!);
    };
    const id = window.setInterval(tick, cycleSec * 1000);
    return () => window.clearInterval(id);
  }, [cycle, cycleSec, sequenceKey]);

  function pointer(e: React.PointerEvent<HTMLCanvasElement>, active: boolean, down?: boolean) {
    const field = fieldRef.current;
    const el = canvasRef.current;
    if (!field || !el) return;
    const r = el.getBoundingClientRect();
    field.setPointer(
      e.clientX - r.left,
      e.clientY - r.top,
      down ?? e.buttons > 0,
      active,
    );
  }

  async function toggleCinema() {
    const root = document.documentElement as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void> | void;
    };
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        setCinema(false);
        return;
      }
      if (root.requestFullscreen) await root.requestFullscreen();
      else root.webkitRequestFullscreen?.();
      setCinema(true);
    } catch {
      setCinema((v) => !v);
      toast(cinema ? "Cinema off" : "Cinema on — screen stays awake");
    }
  }

  function capture() {
    const field = fieldRef.current;
    if (!field) return;
    const src = field.snapshotThumb();
    const st = useStudio.getState();
    st.addShot({
      id: `${Date.now()}`,
      src,
      mode: st.mode,
      palette: st.paletteId,
      at: Date.now(),
    });
    setFlash(true);
    window.setTimeout(() => setFlash(false), 180);
    toast("Frame saved");
  }

  function download() {
    const field = fieldRef.current;
    if (!field) return;
    const a = document.createElement("a");
    a.href = field.exportPng();
    a.download = `aether-${useStudio.getState().mode}.png`;
    a.click();
    toast("Downloaded");
  }

  return (
    <main className="relative h-dvh w-full select-none overflow-hidden bg-bg text-fg">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 size-full touch-none"
        onPointerDown={(e) => {
          if (!useStudio.getState().started) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          pointer(e, true, true);
        }}
        onPointerMove={(e) => {
          if (!useStudio.getState().started) return;
          pointer(e, true, e.buttons > 0);
        }}
        onPointerUp={(e) => pointer(e, true, false)}
        onPointerCancel={(e) => pointer(e, false, false)}
        onPointerLeave={(e) => {
          if (e.buttons === 0) pointer(e, false, false);
        }}
      />

      <div
        className={cn(
          "pointer-events-none absolute inset-0 bg-bg transition-opacity duration-500",
          flash ? "opacity-40" : "opacity-0",
        )}
      />

      {!started ? <StartGate /> : null}
      {started && chrome ? (
        <Chrome
          cinema={cinema}
          onCinema={() => void toggleCinema()}
          onCapture={capture}
          onDownload={download}
          onReset={() => fieldRef.current?.reset()}
        />
      ) : null}
      {started && !chrome ? (
        <button
          type="button"
          aria-label="Show controls"
          title="Show controls (H)"
          onClick={() => useStudio.getState().setChrome(true)}
          className="pointer-events-auto absolute top-[max(0.5rem,env(safe-area-inset-top))] right-3 z-20 flex size-8 items-center justify-center rounded-md bg-surface/80 text-muted shadow-border sm:top-6 sm:right-6 sm:size-11"
        >
          <Eye className="size-4" />
        </button>
      ) : null}
      {galleryOpen ? <Gallery /> : null}

      <Toaster
        theme="dark"
        position="bottom-center"
        toastOptions={{
          classNames: {
            toast: "bg-surface text-fg shadow-border font-sans",
            title: "text-fg",
          },
        }}
      />
    </main>
  );
}

function StartGate() {
  const start = useStudio((s) => s.start);
  const sound = useStudio((s) => s.sound);

  return (
    <div className="absolute inset-0 z-20 flex items-end justify-center bg-bg/50 px-6 pb-16 sm:items-center sm:pb-0">
      <div className="stagger-in w-full max-w-md text-center">
        <p className="text-xs font-medium tracking-widest text-muted uppercase">
          Live field
        </p>
        <h1 className="font-display mt-3 text-6xl leading-none tracking-tight text-fg italic sm:text-7xl">
          Aether
        </h1>
        <p className="mt-4 text-base leading-relaxed text-muted">
          Paint with light. Drag to stir the field. Form and Nerve live in the pool — a body or a cord may gather, then leave.
        </p>
        <div className="mt-8 flex flex-col items-center gap-3">
          <Button
            className="min-w-44"
            onClick={() => {
              start();
              if (sound) void resumeSound();
            }}
          >
            Enter field
          </Button>
          <p className="text-xs text-subtle">
            Drag to stir · 1–7 modes · sound in the corner · S snapshot
          </p>
        </div>
      </div>
    </div>
  );
}

function Chrome({
  cinema,
  onCinema,
  onCapture,
  onDownload,
  onReset,
}: {
  cinema: boolean;
  onCinema: () => void;
  onCapture: () => void;
  onDownload: () => void;
  onReset: () => void;
}) {
  const mode = useStudio((s) => s.mode);
  const panel = useStudio((s) => s.panel);
  const paused = useStudio((s) => s.paused);
  const sound = useStudio((s) => s.sound);
  const shots = useStudio((s) => s.shots);
  const togglePanel = useStudio((s) => s.togglePanel);
  const togglePaused = useStudio((s) => s.togglePaused);
  const toggleSound = useStudio((s) => s.toggleSound);
  const setGalleryOpen = useStudio((s) => s.setGalleryOpen);
  const current = MODES.find((m) => m.id === mode);

  return (
    <>
      <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-2 px-3 pt-[max(0.4rem,env(safe-area-inset-top))] sm:p-6">
        <div className="pointer-events-none min-w-0">
          <p className="font-display text-lg leading-none text-fg italic sm:text-2xl">Aether</p>
          <p className="mt-1 hidden text-xs text-muted sm:block">{current?.hint}</p>
        </div>
        <div className="pointer-events-auto flex shrink-0 items-center gap-0.5 sm:gap-1">
          <Button
            variant="quiet"
            size="icon"
            className="size-8 [&_svg]:size-3.5 sm:size-11 sm:[&_svg]:size-4"
            aria-label={paused ? "Resume" : "Pause"}
            onClick={togglePaused}
          >
            {paused ? <Play className="ml-px" /> : <Pause />}
          </Button>
          <Button
            variant="quiet"
            size="icon"
            className="size-8 [&_svg]:size-3.5 sm:size-11 sm:[&_svg]:size-4"
            aria-label={sound ? "Mute" : "Sound"}
            onClick={() => {
              const turningOn = !useStudio.getState().sound;
              toggleSound();
              if (turningOn) void resumeSound();
            }}
          >
            {sound ? <Volume2 /> : <VolumeX />}
          </Button>
          <Button
            variant="quiet"
            size="icon"
            className="size-8 [&_svg]:size-3.5 sm:size-11 sm:[&_svg]:size-4"
            aria-label="Save frame"
            onClick={onCapture}
          >
            <Camera />
          </Button>
          <Button
            variant="quiet"
            size="icon"
            className="hidden size-8 [&_svg]:size-3.5 sm:inline-flex sm:size-11 sm:[&_svg]:size-4"
            aria-label="Download"
            onClick={onDownload}
          >
            <Download />
          </Button>
          <Button
            variant="quiet"
            size="icon"
            className="size-8 [&_svg]:size-3.5 sm:size-11 sm:[&_svg]:size-4"
            aria-label="Gallery"
            onClick={() => setGalleryOpen(true)}
          >
            <span className="relative">
              <ImageIcon />
              {shots.length > 0 ? (
                <span className="absolute -top-1 -right-1 size-1.5 rounded-full bg-accent" />
              ) : null}
            </span>
          </Button>
          <Button
            variant="quiet"
            size="icon"
            aria-label={panel ? "Hide field" : "Field"}
            title={panel ? "Hide field" : "Field"}
            className={cn(
              "size-8 [&_svg]:size-3.5 sm:size-11 sm:[&_svg]:size-4",
              panel && "bg-fg/10 text-fg",
            )}
            onClick={togglePanel}
          >
            <SlidersHorizontal />
          </Button>
          <Button
            variant="quiet"
            size="icon"
            className="size-8 [&_svg]:size-3.5 sm:size-11 sm:[&_svg]:size-4"
            aria-label={cinema ? "Exit fullscreen" : "Fullscreen"}
            title={cinema ? "Exit fullscreen" : "Fullscreen"}
            onClick={onCinema}
          >
            {cinema ? <Minimize2 /> : <Maximize2 />}
          </Button>
          <Button
            variant="quiet"
            size="icon"
            className="size-8 [&_svg]:size-3.5 sm:size-11 sm:[&_svg]:size-4"
            aria-label="Hide controls"
            title="Hide controls (H)"
            onClick={() => useStudio.getState().setChrome(false)}
          >
            <EyeOff />
          </Button>
        </div>
      </header>

      <aside
        className={cn(
          "pointer-events-auto absolute top-24 bottom-6 left-6 z-20 hidden w-72 flex-col",
          panel && "md:flex",
        )}
      >
        <PanelBody onReset={onReset} />
      </aside>

      <nav className="pointer-events-auto absolute inset-x-0 bottom-0 z-20 grid grid-cols-4 gap-1 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:flex sm:flex-wrap sm:justify-start sm:gap-1">
        {MODES.map((m, i) => (
          <button
            key={m.id}
            type="button"
            onClick={() => useStudio.getState().setMode(m.id)}
            className={cn(
              "h-8 min-w-0 rounded-md px-1.5 text-[11px] font-medium transition-[background-color,color] duration-150 sm:h-10 sm:px-3 sm:text-sm",
              mode === m.id ? "bg-accent text-accent-fg" : "bg-surface/90 text-muted",
            )}
          >
            <span className="sm:hidden">{m.label}</span>
            <span className="hidden sm:inline">
              {i + 1} {m.label}
            </span>
          </button>
        ))}
      </nav>

      {panel ? (
        <div className="pointer-events-auto absolute inset-x-0 bottom-16 z-30 md:hidden">
          <button
            type="button"
            aria-label="Close controls"
            className="absolute inset-x-0 -top-24 h-24"
            onClick={togglePanel}
          />
          <div className="max-h-[70dvh] overflow-y-auto rounded-t-xl bg-surface px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-border">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium">Field</p>
              <Button variant="ghost" size="icon-sm" aria-label="Close" onClick={togglePanel}>
                <X />
              </Button>
            </div>
            <PanelBody onReset={onReset} compact />
          </div>
        </div>
      ) : null}
    </>
  );
}

function PanelBody({ onReset, compact = false }: { onReset: () => void; compact?: boolean }) {
  const mode = useStudio((s) => s.mode);
  const paletteId = useStudio((s) => s.paletteId);
  const cycle = useStudio((s) => s.cycle);
  const sequence = useStudio((s) => s.sequence);
  const density = useStudio((s) => s.density);
  const flow = useStudio((s) => s.flow);
  const trail = useStudio((s) => s.trail);
  const setMode = useStudio((s) => s.setMode);
  const setPalette = useStudio((s) => s.setPalette);
  const setDensity = useStudio((s) => s.setDensity);
  const setFlow = useStudio((s) => s.setFlow);
  const setTrail = useStudio((s) => s.setTrail);

  return (
    <div
      className={cn(
        "flex flex-col gap-5",
        !compact && "h-full overflow-y-auto rounded-xl bg-surface/90 p-4 shadow-border",
      )}
    >
      {!compact ? (
        <div className="-mt-1 -mr-1 flex items-center justify-between">
          <p className="text-xs font-medium tracking-wide text-muted uppercase">Field</p>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Hide field"
            onClick={() => useStudio.getState().setPanel(false)}
          >
            <X />
          </Button>
        </div>
      ) : null}

      <SoundPanel compact={compact} />

      <div>
        <p className="mb-2 text-xs font-medium tracking-wide text-muted uppercase">Wind</p>
        <div className={cn("grid gap-1", compact ? "grid-cols-4" : "grid-cols-1")}>
          {MODES.map((m, i) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMode(m.id)}
              className={cn(
                "h-11 rounded-sm px-3 text-left text-sm font-medium transition-[background-color,color] duration-150",
                compact && "px-1 text-center text-xs",
                mode === m.id ? "bg-accent text-accent-fg" : "text-muted hover:bg-fg/10 hover:text-fg",
              )}
            >
              {compact ? m.label : `${i + 1}  ${m.label}`}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium tracking-wide text-muted uppercase">Palette</p>
        <div className="flex flex-wrap gap-2">
          {PALETTES.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-label={p.label}
              title={p.label}
              onClick={() => {
                const st = useStudio.getState();
                if (st.cycle === "sequence") st.toggleSequence(p.id);
                else st.setPalette(p.id);
              }}
              className={cn(
                "relative size-9 rounded-full transition-[box-shadow,transform] duration-150 ease-out active:scale-[0.96] sm:size-11",
                paletteId === p.id ? "shadow-border-hover" : "shadow-border",
                cycle === "sequence" && !sequence.includes(p.id) && "opacity-35",
              )}
            >
              <span
                className="absolute inset-1 rounded-full"
                style={{ background: p.colors[1] }}
              />
              {cycle === "sequence" ? (
                <span className="absolute -right-0.5 -bottom-0.5 flex size-4 items-center justify-center rounded-full bg-bg text-[9px] text-fg">
                  {sequence.indexOf(p.id) >= 0 ? sequence.indexOf(p.id) + 1 : ""}
                </span>
              ) : null}
            </button>
          ))}
        </div>
        <PaletteCycle />
      </div>

      <FieldSlider label="Density" value={density} onChange={setDensity} />
      <FieldSlider label="Flow" value={flow} onChange={setFlow} />
      <FieldSlider label="Trail" value={trail} onChange={setTrail} />

      <div className={cn("mt-auto flex gap-2", compact && "mt-1")}>
        <Button variant="outline" className="flex-1" onClick={onReset}>
          <RotateCcw />
          Clear
        </Button>
      </div>
    </div>
  );
}

function PaletteCycle() {
  const cycle = useStudio((s) => s.cycle);
  const cycleSec = useStudio((s) => s.cycleSec);
  const setCycle = useStudio((s) => s.setCycle);
  const setCycleSec = useStudio((s) => s.setCycleSec);
  const modes: { id: CycleMode; label: string }[] = [
    { id: "hold", label: "Hold" },
    { id: "random", label: "Random" },
    { id: "sequence", label: "Sequence" },
  ];
  return (
    <div className="mt-3">
      <div className="grid grid-cols-3 gap-1">
        {modes.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setCycle(m.id)}
            className={cn(
              "h-8 rounded-sm text-[11px] font-medium sm:h-11 sm:text-sm",
              cycle === m.id ? "bg-accent text-accent-fg" : "text-muted hover:bg-fg/10 hover:text-fg",
            )}
          >
            {m.label}
          </button>
        ))}
      </div>
      {cycle !== "hold" ? (
        <div className="mt-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium tracking-wide text-muted uppercase">Seconds</p>
            <p className="font-mono text-xs tabular-nums text-subtle">{cycleSec}</p>
          </div>
          <Slider value={cycleSec} min={5} max={120} onValueChange={setCycleSec} />
        </div>
      ) : null}
      {cycle === "sequence" ? (
        <p className="mt-2 text-[11px] text-subtle">Tap swatches to build the loop. Order is tap order.</p>
      ) : null}
    </div>
  );
}

function SoundPanel({ compact }: { compact: boolean }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const volume = useStudio((s) => s.volume);
  const loop = useStudio((s) => s.loop);
  const sourceId = useStudio((s) => s.sourceId);
  const customName = useStudio((s) => s.customName);
  const setVolume = useStudio((s) => s.setVolume);
  const setLoop = useStudio((s) => s.setLoop);
  const setSourceId = useStudio((s) => s.setSourceId);
  const setCustomName = useStudio((s) => s.setCustomName);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setCustomName(file.name);
    await loadCustomSound(file);
    if (!useStudio.getState().sound) {
      useStudio.getState().toggleSound();
    } else {
      await resumeSound();
    }
  }

  return (
    <div>
      <p className="mb-2 text-xs font-medium tracking-wide text-muted uppercase">Sound</p>
      <div className={cn("grid gap-1", compact ? "grid-cols-3" : "grid-cols-1")}>
        {(
          [
            { id: "aether" as const, label: "Aether" },
            { id: "field" as const, label: "Field" },
          ] as const
        ).map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => setSourceId(opt.id)}
            className={cn(
              "h-11 whitespace-nowrap rounded-sm px-3 text-left text-sm font-medium transition-[background-color,color] duration-150",
              compact && "px-1 text-center text-xs",
              sourceId === opt.id ? "bg-accent text-accent-fg" : "text-muted hover:bg-fg/10 hover:text-fg",
            )}
          >
            {opt.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className={cn(
            "h-11 whitespace-nowrap rounded-sm px-3 text-left text-sm font-medium transition-[background-color,color] duration-150",
            compact && "px-1 text-center text-xs",
            sourceId === "custom" ? "bg-accent text-accent-fg" : "text-muted hover:bg-fg/10 hover:text-fg",
          )}
        >
          {compact ? (
            sourceId === "custom" && customName ? customName.replace(/\.[^.]+$/, "") : "File"
          ) : (
            <span className="inline-flex items-center gap-2">
              <Upload className="size-3.5" />
              {sourceId === "custom" && customName ? customName.replace(/\.[^.]+$/, "") : "Choose"}
            </span>
          )}
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="audio/*,.mp3,.wav,.ogg,.m4a,.flac"
        className="hidden"
        aria-label="Choose a sound file"
        onChange={(e) => {
          const file = e.target.files?.[0];
          void onFile(file);
          e.target.value = "";
        }}
      />

      <div className="mt-3">
        <FieldSlider label="Volume" value={volume} onChange={setVolume} />
      </div>

      {sourceId !== "field" ? (
        <div className="mt-3 flex gap-1">
          <button
            type="button"
            onClick={() => setLoop(false)}
            className={cn(
              "inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-sm text-sm font-medium transition-[background-color,color] duration-150",
              !loop ? "bg-accent text-accent-fg" : "text-muted hover:bg-fg/10 hover:text-fg",
            )}
          >
            <Repeat1 className="size-3.5" />
            Once
          </button>
          <button
            type="button"
            onClick={() => setLoop(true)}
            className={cn(
              "inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-sm text-sm font-medium transition-[background-color,color] duration-150",
              loop ? "bg-accent text-accent-fg" : "text-muted hover:bg-fg/10 hover:text-fg",
            )}
          >
            <Repeat className="size-3.5" />
            Loop
          </button>
        </div>
      ) : (
        <p className="mt-2 text-xs text-subtle">Field is live — it does not end.</p>
      )}
    </div>
  );
}

function FieldSlider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium tracking-wide text-muted uppercase">{label}</p>
        <p className="font-mono text-xs tabular-nums text-subtle">{value}</p>
      </div>
      <Slider value={value} onValueChange={onChange} />
    </div>
  );
}

function Gallery() {
  const shots = useStudio((s) => s.shots);
  const close = () => useStudio.getState().setGalleryOpen(false);
  const remove = useStudio((s) => s.removeShot);

  return (
    <div className="absolute inset-0 z-40 flex items-end justify-center bg-bg/70 p-4 sm:items-center">
      <button type="button" className="absolute inset-0" aria-label="Close gallery" onClick={close} />
      <div
        role="dialog"
        aria-label="Saved frames"
        className="relative z-10 flex max-h-[80dvh] w-full max-w-lg flex-col rounded-xl bg-surface p-4 shadow-border"
      >
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="font-display text-2xl italic">Frames</p>
            <p className="text-xs text-muted">Kept on this device</p>
          </div>
          <Button variant="ghost" size="icon-sm" aria-label="Close" onClick={close}>
            <X />
          </Button>
        </div>
        {shots.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted">
            No frames yet. Press S while you paint.
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-2 overflow-y-auto">
            {shots.map((s) => (
              <li key={s.id} className="group relative overflow-hidden rounded-md">
                <img
                  src={s.src}
                  alt={`${s.mode} frame`}
                  className="aspect-video w-full object-cover outline outline-1 -outline-offset-1 outline-fg/10"
                />
                <button
                  type="button"
                  aria-label="Remove frame"
                  onClick={() => remove(s.id)}
                  className="absolute top-1.5 right-1.5 flex size-9 items-center justify-center rounded-sm bg-bg/80 text-fg opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                >
                  <X className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
