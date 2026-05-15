import React, { useRef, useEffect, useState, useCallback, useMemo, memo } from 'react';
import { ConfigData, HUDModule, AnchorType } from '../types';
import { useHUDDrag } from '../hooks/useHUDDrag';

interface HUDCanvasProps {
  config: ConfigData;
  defaults: ConfigData;
  modules: HUDModule[];
  onUpdate: (path: string[], value: any, skipHistory?: boolean) => void;
}

const SECTION = 'mod_menu_config@gc.pnl';

// HUD module sizes & offsets are authored in reference-space pixels (Minecraft 1080p landscape).
// At runtime the canvas may be any size — we scale everything by canvasWidth / REFERENCE_WIDTH.
const REFERENCE_WIDTH = 1920;
const MIN_SCALE = 0.55;
// Touch devices need a larger floor — raw scale at 360px wide would shrink modules
// to ~8px tall, which is impossible to grab with a finger.
const MIN_SCALE_TOUCH = 0.75;

const ANCHORS: AnchorType[] = [
  'top_left', 'top_middle', 'top_right',
  'left_middle', 'middle', 'right_middle',
  'bottom_left', 'bottom_middle', 'bottom_right',
];

const ANCHOR_LABELS: Record<AnchorType, string> = {
  top_left: 'TL', top_middle: 'TM', top_right: 'TR',
  left_middle: 'LM', middle: 'MID', right_middle: 'RM',
  bottom_left: 'BL', bottom_middle: 'BM', bottom_right: 'BR',
};

const BG_URL =
  'https://media.discordapp.net/attachments/1252981510223429693/1501843952641245274/mcbe-1-21-101-bug-annoyed-me-v0-b242anJjYW1hY25mMY5dEpPuyyCI1iDCMPySbQqxA3mE9rTLMSd0Qkjlly98.png?ex=6a0818ad&is=6a06c72d&hm=7b53d9d9b9093d988e7e81394c53598cf430defe03a26b5ff0b2ba3fb0654b5b&=&width=1245&height=700';

const computePosition = (
  anchor: AnchorType,
  offset: [number, number],
  w: number,
  h: number,
  cw: number,
  ch: number,
) => {
  let x: number, y: number;
  if (anchor.includes('left')) x = offset[0];
  else if (anchor.includes('right')) x = cw - w + offset[0];
  else x = (cw - w) / 2 + offset[0];
  if (anchor.includes('top')) y = offset[1];
  else if (anchor.includes('bottom')) y = ch - h + offset[1];
  else y = (ch - h) / 2 + offset[1];
  return { x, y };
};

interface ModuleViewProps {
  mod: HUDModule;
  x: number;
  y: number;
  scale: number;
  isDragging: boolean;
  isSelected: boolean;
  onPointerDown: (e: React.PointerEvent, mod: HUDModule) => void;
}

const ModuleView = memo<ModuleViewProps>(({ mod, x, y, scale, isDragging, isSelected, onPointerDown }) => {
  const w = mod.width * scale;
  const h = mod.height * scale;
  const style: React.CSSProperties = {
    position: 'absolute',
    left: 0,
    top: 0,
    width: `${w}px`,
    height: `${h}px`,
    transform: `translate3d(${Math.round(x * scale)}px, ${Math.round(y * scale)}px, 0)`,
    zIndex: isDragging ? 200 : isSelected ? 150 : 50,
    transition: isDragging ? 'none' : 'transform .12s cubic-bezier(.4,0,.2,1), background-color .15s, border-color .15s',
    willChange: isDragging ? 'transform' : 'auto',
    touchAction: 'none',
    userSelect: 'none',
  };
  return (
    <div
      onPointerDown={e => onPointerDown(e, mod)}
      className={`flex items-center justify-center rounded-md border shadow-md ${
        isDragging
          ? 'bg-blurple border-white/80 shadow-[0_0_30px_rgba(114,137,218,.65)] cursor-grabbing'
          : isSelected
            ? 'bg-glacier-darkest border-blurple cursor-grab'
            : 'bg-glacier-darkest/85 border-white/10 hover:border-blurple/50 hover:bg-glacier-darker cursor-grab'
      }`}
      style={style}
      role="button"
      aria-label={`Drag ${mod.id}`}
    >
      <i className={`fas ${mod.icon} ${isDragging ? 'text-white' : 'text-glacier-muted'}`} style={{ fontSize: `${Math.max(8, 10 * scale)}px` }}></i>
      {(isDragging || isSelected) && (
        <div className="absolute left-1/2 -translate-x-1/2 pointer-events-none" style={{ top: `${h + 6}px` }}>
          <span className="text-[9px] font-black text-white bg-glacier-black/95 border border-blurple/30 px-2 py-0.5 rounded-md uppercase tracking-widest whitespace-nowrap shadow-md">
            {mod.id}
          </span>
        </div>
      )}
    </div>
  );
});
ModuleView.displayName = 'ModuleView';

const HUDCanvas: React.FC<HUDCanvasProps> = ({ config, defaults, modules, onUpdate }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [fullscreen, setFullscreen] = useState(false);
  const [showBackground, setShowBackground] = useState(true);
  const [coarsePointer, setCoarsePointer] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(pointer: coarse)').matches
      : false,
  );

  // Track pointer type — when a touch device docks/undocks a mouse this can change.
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia('(pointer: coarse)');
    const onChange = (e: MediaQueryListEvent) => setCoarsePointer(e.matches);
    if (mql.addEventListener) mql.addEventListener('change', onChange);
    else mql.addListener(onChange);
    return () => {
      if (mql.removeEventListener) mql.removeEventListener('change', onChange);
      else mql.removeListener(onChange);
    };
  }, []);

  const enterFullscreen = useCallback(async () => {
    const el = wrapperRef.current;
    if (!el) { setFullscreen(true); return; }
    const req = (el.requestFullscreen
      || (el as any).webkitRequestFullscreen
      || (el as any).msRequestFullscreen) as undefined | ((opts?: any) => Promise<void>);
    try {
      if (req) await req.call(el, { navigationUI: 'hide' } as any);
    } catch { /* user gesture issues, etc. — fall back to CSS overlay */ }
    setFullscreen(true);
    try {
      const orientation = (screen as any).orientation;
      if (orientation && typeof orientation.lock === 'function') {
        await orientation.lock('landscape');
      }
    } catch { /* unsupported (iOS Safari, desktop) — silent per design */ }
  }, []);

  const exitFullscreen = useCallback(async () => {
    try {
      const orientation = (screen as any).orientation;
      if (orientation && typeof orientation.unlock === 'function') orientation.unlock();
    } catch { /* ignore */ }
    try {
      if (document.fullscreenElement
        || (document as any).webkitFullscreenElement
        || (document as any).msFullscreenElement) {
        const exit = (document.exitFullscreen
          || (document as any).webkitExitFullscreen
          || (document as any).msExitFullscreen) as undefined | (() => Promise<void>);
        if (exit) await exit.call(document);
      }
    } catch { /* ignore */ }
    setFullscreen(false);
  }, []);

  // Keep React state in sync if user exits fullscreen via Esc / system gesture.
  useEffect(() => {
    const onChange = () => {
      const isFs = !!(document.fullscreenElement
        || (document as any).webkitFullscreenElement
        || (document as any).msFullscreenElement);
      if (!isFs) {
        try {
          const orientation = (screen as any).orientation;
          if (orientation && typeof orientation.unlock === 'function') orientation.unlock();
        } catch { /* ignore */ }
        setFullscreen(false);
      }
    };
    document.addEventListener('fullscreenchange', onChange);
    document.addEventListener('webkitfullscreenchange', onChange as any);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      document.removeEventListener('webkitfullscreenchange', onChange as any);
    };
  }, []);

  const settings = config[SECTION];

  const scale = canvasSize.width > 0
    ? Math.max(coarsePointer ? MIN_SCALE_TOUCH : MIN_SCALE, canvasSize.width / REFERENCE_WIDTH)
    : 1;

  const visibleModules = useMemo(() => {
    if (!settings) return [] as HUDModule[];
    return modules.filter(m => settings[m.toggleKey]);
  }, [modules, settings]);

  // Track canvas size with ResizeObserver — re-attaches on fullscreen toggle.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      setCanvasSize(prev => (prev.width === w && prev.height === h ? prev : { width: w, height: h }));
    };
    update();
    const obs = new ResizeObserver(update);
    obs.observe(el);
    return () => obs.disconnect();
  }, [fullscreen]);

  const {
    drag,
    selectedId,
    setSelectedId,
    onModulePointerDown: onPointerDown,
    snapToAnchor,
    recenterSelected,
  } = useHUDDrag({ containerRef, modules, settings, defaults: defaults[SECTION], scale, section: SECTION, onUpdate });

  // Esc / arrow keys — nudge selected, deselect, exit fullscreen.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.key === 'Escape') {
        if (fullscreen) { exitFullscreen(); return; }
        if (selectedId) { setSelectedId(null); return; }
        return;
      }
      if (!selectedId || !settings) return;
      const mod = modules.find(m => m.id === selectedId);
      if (!mod) return;
      const offset = (settings[mod.offsetKey] as [number, number]) || [0, 0];
      const step = e.shiftKey ? 10 : 1;
      let dx = 0, dy = 0;
      if (e.key === 'ArrowLeft') dx = -step;
      else if (e.key === 'ArrowRight') dx = step;
      else if (e.key === 'ArrowUp') dy = -step;
      else if (e.key === 'ArrowDown') dy = step;
      else return;
      e.preventDefault();
      onUpdate([SECTION, mod.offsetKey], [offset[0] + dx, offset[1] + dy]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fullscreen, selectedId, modules, settings, onUpdate, exitFullscreen]);

  // Body scroll lock for fullscreen
  useEffect(() => {
    if (!fullscreen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [fullscreen]);

  const onContainerPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.target === containerRef.current) setSelectedId(null);
  }, []);

  const selectedMod = selectedId ? modules.find(m => m.id === selectedId) : null;
  const selectedAnchor = selectedMod && settings ? (drag?.id === selectedMod.id ? drag.anchor : (settings[selectedMod.anchorKey] as AnchorType)) : null;
  const selectedOffset = selectedMod && settings ? (drag?.id === selectedMod.id ? drag.offset : ((settings[selectedMod.offsetKey] as [number, number]) || [0, 0])) : null;

  const wrapperClass = fullscreen
    ? 'fixed inset-0 z-[1500] bg-black/95 backdrop-blur-sm flex flex-col select-none p-3 md:p-5 anim-fade-in'
    : 'w-full h-full flex flex-col select-none';

  const canvasClass = fullscreen
    ? 'relative w-full flex-1 min-h-0 border-2 border-white/15 rounded-2xl overflow-hidden shadow-2xl bg-glacier-black'
    : 'relative w-full aspect-video border-2 border-white/10 rounded-2xl overflow-hidden shadow-inner flex-shrink-0 bg-gradient-to-br from-glacier-black/80 to-black/60';

  return (
    <div ref={wrapperRef} className={wrapperClass} style={{ touchAction: 'none' }}>
      {fullscreen && (
        <div className="flex items-center justify-between mb-3 px-1 shrink-0 gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <i className="fas fa-expand text-blurple"></i>
            <span className="text-xs md:text-sm font-extrabold uppercase tracking-widest gradient-text-blurple truncate">
              HUD Layout · Fullscreen
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowBackground(b => !b)}
              className={`px-3 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border ${
                showBackground ? 'bg-blurple/20 text-blurple border-blurple/30' : 'bg-glacier-black/70 text-glacier-muted border-white/10 hover:text-white'
              }`}
              title="Toggle Minecraft background"
            >
              <i className={`fas ${showBackground ? 'fa-image' : 'fa-image-portrait'} mr-1.5`}></i>
              {showBackground ? 'BG On' : 'BG Off'}
            </button>
            <button
              onClick={exitFullscreen}
              className="px-4 py-2 rounded-full bg-glacier-red/15 hover:bg-glacier-red/25 text-glacier-red border border-glacier-red/25 text-[10px] font-black uppercase tracking-widest transition-all"
              title="Exit fullscreen (Esc)"
            >
              <i className="fas fa-compress mr-1.5"></i>Exit
            </button>
          </div>
        </div>
      )}

      <div
        ref={containerRef}
        onPointerDown={onContainerPointerDown}
        className={`${canvasClass} touch-none`}
      >
        {showBackground && (
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: `url(${BG_URL})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              imageRendering: 'pixelated',
              opacity: fullscreen ? 0.95 : 0.7,
            }}
          />
        )}
        {showBackground && <div className="absolute inset-0 bg-black/25 pointer-events-none" />}
        {!showBackground && (
          <div className="absolute inset-0 bg-[radial-gradient(rgba(114,137,218,.18)_1px,transparent_1px)] [background-size:24px_24px] opacity-50 pointer-events-none" />
        )}

        {selectedId && (
          <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 p-2.5 gap-2 pointer-events-none z-[60]">
            {ANCHORS.map(anchor => {
              const isHover = drag?.anchor === anchor;
              return (
                <button
                  key={anchor}
                  onPointerDown={e => e.stopPropagation()}
                  onClick={() => snapToAnchor(anchor)}
                  className={`pointer-events-auto rounded-xl border transition-all duration-150 flex items-center justify-center group/snap ${
                    isHover
                      ? 'bg-blurple/30 border-blurple shadow-[0_0_22px_rgba(114,137,218,.55)]'
                      : 'bg-blurple/5 border-blurple/15 hover:bg-blurple/20 hover:border-blurple/50'
                  }`}
                  aria-label={`Snap to ${anchor.replace(/_/g, ' ')}`}
                >
                  <span className={`text-[9px] font-black uppercase tracking-widest transition-opacity ${isHover ? 'text-white opacity-100' : 'text-blurple/60 opacity-0 group-hover/snap:opacity-100'}`}>
                    {ANCHOR_LABELS[anchor]}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {canvasSize.width > 0 && canvasSize.height > 0 && visibleModules.map(mod => {
          const isDragging = drag?.id === mod.id;
          const anchor = isDragging ? drag!.anchor : (settings[mod.anchorKey] as AnchorType) || 'top_left';
          const offset = isDragging ? drag!.offset : (settings[mod.offsetKey] as [number, number]) || [0, 0];
          // Position is computed in reference-space; ModuleView multiplies by scale for the DOM.
          const refW = canvasSize.width / scale;
          const refH = canvasSize.height / scale;
          const { x, y } = computePosition(anchor, offset, mod.width, mod.height, refW, refH);
          return (
            <ModuleView
              key={mod.id}
              mod={mod}
              x={x}
              y={y}
              scale={scale}
              isDragging={isDragging}
              isSelected={selectedId === mod.id}
              onPointerDown={onPointerDown}
            />
          );
        })}

        {visibleModules.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="px-5 py-4 bg-glacier-black/85 border border-white/10 rounded-2xl backdrop-blur-md flex flex-col items-center gap-1.5">
              <i className="fas fa-grip-dots-vertical text-2xl text-glacier-muted/70"></i>
              <span className="text-[10px] uppercase tracking-widest text-white font-black">No active HUD elements</span>
              <span className="text-[10px] text-glacier-muted">Toggle modules in the config panel</span>
            </div>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center shrink-0">
        <div className="flex-1 bg-glacier-black/40 rounded-xl px-4 py-2.5 border border-white/5 min-h-[44px] flex items-center">
          {selectedMod && selectedAnchor && selectedOffset ? (
            <div className="flex items-center gap-2.5 flex-wrap text-[10px] font-black uppercase tracking-widest">
              <span className="text-blurple"><i className={`fas ${selectedMod.icon} mr-1.5`}></i>{selectedMod.id}</span>
              <span className="text-glacier-muted">·</span>
              <span className="text-white">{selectedAnchor.replace(/_/g, ' ')}</span>
              <span className="text-glacier-muted">·</span>
              <span className="text-glacier-muted font-mono">({selectedOffset[0]}, {selectedOffset[1]})</span>
            </div>
          ) : (
            <span className="text-[10px] font-black uppercase tracking-widest text-glacier-muted">
              <i className="fas fa-hand-pointer mr-1.5"></i>Tap an element · drag to move · arrow keys nudge · Esc to deselect
            </span>
          )}
        </div>
        {selectedId && (
          <button
            onClick={recenterSelected}
            className="px-4 py-2.5 rounded-xl bg-blurple/15 hover:bg-blurple/25 text-blurple border border-blurple/25 text-[10px] font-black uppercase tracking-widest transition-all"
            title="Restore selected module to its default position"
          >
            <i className="fas fa-rotate-left mr-1.5"></i>Reset Position
          </button>
        )}
        {!fullscreen ? (
          <button
            onClick={enterFullscreen}
            className="px-4 py-2.5 rounded-xl bg-glacier-black/70 hover:bg-blurple/20 hover:text-white text-glacier-muted border border-white/10 hover:border-blurple/30 text-[10px] font-black uppercase tracking-widest transition-all"
            title="Open fullscreen editor"
          >
            <i className="fas fa-expand mr-1.5"></i>Fullscreen
          </button>
        ) : (
          <button
            onClick={() => setShowBackground(b => !b)}
            className={`sm:hidden px-4 py-2.5 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all ${showBackground ? 'bg-blurple/15 text-blurple border-blurple/25' : 'bg-glacier-black/70 text-glacier-muted border-white/10'}`}
          >
            <i className={`fas ${showBackground ? 'fa-image' : 'fa-image-portrait'} mr-1.5`}></i>
            {showBackground ? 'Hide BG' : 'Show BG'}
          </button>
        )}
      </div>
    </div>
  );
};

export default HUDCanvas;
