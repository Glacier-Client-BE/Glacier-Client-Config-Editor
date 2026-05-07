import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { ConfigData, HUDModule, AnchorType } from '../types';

interface HUDCanvasProps {
  config: ConfigData;
  modules: HUDModule[];
  onUpdate: (path: string[], value: any, skipHistory?: boolean) => void;
}

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

const SECTION = 'mod_menu_config@gc.pnl';

const getAnchorStyles = (anchor: AnchorType): React.CSSProperties => {
  switch (anchor) {
    case 'top_left':       return { top: 0, left: 0 };
    case 'top_middle':     return { top: 0, left: '50%', transform: 'translateX(-50%)' };
    case 'top_right':      return { top: 0, right: 0 };
    case 'left_middle':    return { top: '50%', left: 0, transform: 'translateY(-50%)' };
    case 'middle':         return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
    case 'right_middle':   return { top: '50%', right: 0, transform: 'translateY(-50%)' };
    case 'bottom_left':    return { bottom: 0, left: 0 };
    case 'bottom_middle':  return { bottom: 0, left: '50%', transform: 'translateX(-50%)' };
    case 'bottom_right':   return { bottom: 0, right: 0 };
    default:               return { top: 0, left: 0 };
  }
};

const HUDCanvas: React.FC<HUDCanvasProps> = ({ config, modules, onUpdate }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const moduleRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());
  const dragState = useRef<{
    id: string | null;
    pointerId: number | null;
    startTime: number;
    startX: number;
    startY: number;
    moved: boolean;
    rect: DOMRect | null;
    rafPending: boolean;
    lastClientX: number;
    lastClientY: number;
    pendingAnchor: AnchorType | null;
    pendingOffset: [number, number] | null;
  }>({
    id: null, pointerId: null, startTime: 0, startX: 0, startY: 0,
    moved: false, rect: null, rafPending: false,
    lastClientX: 0, lastClientY: 0, pendingAnchor: null, pendingOffset: null,
  });

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredAnchor, setHoveredAnchor] = useState<AnchorType | null>(null);

  const visibleModules = useMemo(() => {
    const settings = config[SECTION];
    if (!settings) return [];
    return modules.filter(m => settings[m.toggleKey]);
  }, [modules, config]);

  const computeAnchorAndOffset = useCallback((clientX: number, clientY: number, rect: DOMRect): { anchor: AnchorType; offset: [number, number] } => {
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, clientY - rect.top));

    const h: 'left' | 'middle' | 'right' = x < rect.width / 3 ? 'left' : x > (rect.width / 3) * 2 ? 'right' : 'middle';
    const v: 'top' | 'middle' | 'bottom' = y < rect.height / 3 ? 'top' : y > (rect.height / 3) * 2 ? 'bottom' : 'middle';

    let anchor: AnchorType = 'middle';
    if (v === 'middle' && h === 'middle') anchor = 'middle';
    else if (v === 'middle') anchor = `${h}_middle` as AnchorType;
    else if (h === 'middle') anchor = `${v}_middle` as AnchorType;
    else anchor = `${v}_${h}` as AnchorType;

    let ox = 0, oy = 0;
    if (h === 'left') ox = x;
    else if (h === 'right') ox = -(rect.width - x);
    else ox = x - rect.width / 2;
    if (v === 'top') oy = y;
    else if (v === 'bottom') oy = -(rect.height - y);
    else oy = y - rect.height / 2;

    return { anchor, offset: [Math.round(ox), Math.round(oy)] };
  }, []);

  const applyVisualPreview = useCallback((id: string, anchor: AnchorType, offset: [number, number], rect: DOMRect) => {
    const el = moduleRefs.current.get(id);
    if (!el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;

    let x = 0, y = 0;
    if (anchor.includes('left')) x = offset[0];
    else if (anchor.includes('right')) x = rect.width - w + offset[0];
    else x = (rect.width - w) / 2 + offset[0];

    if (anchor.includes('top')) y = offset[1];
    else if (anchor.includes('bottom')) y = rect.height - h + offset[1];
    else y = (rect.height - h) / 2 + offset[1];

    el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    el.style.left = '0';
    el.style.top = '0';
    el.style.right = 'auto';
    el.style.bottom = 'auto';
    el.style.marginLeft = '0';
    el.style.marginRight = '0';
    el.style.marginTop = '0';
    el.style.marginBottom = '0';
  }, []);

  const flushDrag = useCallback(() => {
    const s = dragState.current;
    s.rafPending = false;
    if (!s.id || !s.rect) return;
    const { anchor, offset } = computeAnchorAndOffset(s.lastClientX, s.lastClientY, s.rect);
    s.pendingAnchor = anchor;
    s.pendingOffset = offset;
    setHoveredAnchor(anchor);
    applyVisualPreview(s.id, anchor, offset, s.rect);
  }, [computeAnchorAndOffset, applyVisualPreview]);

  const onPointerDown = useCallback((e: React.PointerEvent, id: string) => {
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture?.(e.pointerId);
    const rect = containerRef.current?.getBoundingClientRect() ?? null;
    dragState.current = {
      id,
      pointerId: e.pointerId,
      startTime: performance.now(),
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
      rect,
      rafPending: false,
      lastClientX: e.clientX,
      lastClientY: e.clientY,
      pendingAnchor: null,
      pendingOffset: null,
    };
    setSelectedId(id);
    setDraggingId(id);
  }, []);

  useEffect(() => {
    const onPointerMove = (e: PointerEvent) => {
      const s = dragState.current;
      if (!s.id || s.pointerId !== e.pointerId) return;
      s.lastClientX = e.clientX;
      s.lastClientY = e.clientY;
      const dx = Math.abs(e.clientX - s.startX);
      const dy = Math.abs(e.clientY - s.startY);
      if (!s.moved && (dx > 3 || dy > 3)) s.moved = true;
      if (!s.rafPending) {
        s.rafPending = true;
        requestAnimationFrame(flushDrag);
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      const s = dragState.current;
      if (!s.id || s.pointerId !== e.pointerId) return;
      const id = s.id;
      const anchor = s.pendingAnchor;
      const offset = s.pendingOffset;
      const moved = s.moved;
      const mod = modules.find(m => m.id === id);

      // Reset visual overrides — let React take over again
      const el = moduleRefs.current.get(id);
      if (el) {
        el.style.transform = '';
        el.style.left = '';
        el.style.top = '';
        el.style.right = '';
        el.style.bottom = '';
        el.style.marginLeft = '';
        el.style.marginRight = '';
        el.style.marginTop = '';
        el.style.marginBottom = '';
      }

      dragState.current = {
        id: null, pointerId: null, startTime: 0, startX: 0, startY: 0,
        moved: false, rect: null, rafPending: false,
        lastClientX: 0, lastClientY: 0, pendingAnchor: null, pendingOffset: null,
      };
      setDraggingId(null);
      setHoveredAnchor(null);

      if (moved && mod && anchor && offset) {
        onUpdate([SECTION, mod.anchorKey], anchor);
        onUpdate([SECTION, mod.offsetKey], offset, true);
      }
    };

    const onPointerCancel = onPointerUp;

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerCancel);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerCancel);
    };
  }, [flushDrag, modules, onUpdate]);

  const snapToAnchor = useCallback((anchor: AnchorType) => {
    if (!selectedId) return;
    const mod = modules.find(m => m.id === selectedId);
    if (!mod) return;
    onUpdate([SECTION, mod.anchorKey], anchor);
    onUpdate([SECTION, mod.offsetKey], [0, 0], true);
  }, [selectedId, modules, onUpdate]);

  const recenterSelected = useCallback(() => {
    if (!selectedId) return;
    const mod = modules.find(m => m.id === selectedId);
    if (!mod) return;
    onUpdate([SECTION, mod.offsetKey], [0, 0]);
  }, [selectedId, modules, onUpdate]);

  const onContainerClick = useCallback((e: React.MouseEvent) => {
    if (e.target === containerRef.current) setSelectedId(null);
  }, []);

  const selectedMod = selectedId ? modules.find(m => m.id === selectedId) : null;
  const selectedSettings = selectedMod ? config[SECTION] : null;

  return (
    <div className="w-full h-full flex flex-col select-none">
      <div
        ref={containerRef}
        onPointerDown={onContainerClick as any}
        className="hud-grid relative w-full aspect-video bg-gradient-to-br from-glacier-black/80 to-black/60 border-2 border-white/10 rounded-2xl overflow-hidden shadow-inner flex-shrink-0 touch-none"
      >
        <div className="absolute inset-0 bg-[radial-gradient(rgba(114,137,218,.15)_1px,transparent_1px)] [background-size:24px_24px] opacity-40 pointer-events-none"></div>

        {selectedId && (
          <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 p-3 gap-2 pointer-events-none z-[60]">
            {ANCHORS.map(anchor => {
              const isActive = hoveredAnchor === anchor && !!draggingId;
              return (
                <button
                  key={anchor}
                  onPointerDown={e => e.stopPropagation()}
                  onClick={() => snapToAnchor(anchor)}
                  className={`pointer-events-auto rounded-xl border transition-all flex items-center justify-center group/snap ${
                    isActive
                      ? 'bg-blurple/30 border-blurple shadow-[0_0_22px_rgba(114,137,218,.55)]'
                      : 'bg-blurple/5 border-blurple/15 hover:bg-blurple/20 hover:border-blurple/50'
                  }`}
                  aria-label={`Snap to ${anchor}`}
                >
                  <span className={`text-[9px] font-black uppercase tracking-widest transition-opacity ${isActive ? 'text-white opacity-100' : 'text-blurple/60 opacity-0 group-hover/snap:opacity-100'}`}>
                    {ANCHOR_LABELS[anchor]}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {visibleModules.map(mod => {
          const settings = config[SECTION];
          const anchor = settings[mod.anchorKey] as AnchorType;
          const offset = (settings[mod.offsetKey] as [number, number]) || [0, 0];
          const isDragging = draggingId === mod.id;
          const isSelected = selectedId === mod.id;
          const anchorStyle = getAnchorStyles(anchor);

          const style: React.CSSProperties = {
            ...anchorStyle,
            position: 'absolute',
            width: `${mod.width}px`,
            height: `${mod.height}px`,
            marginLeft: anchor.includes('right') ? undefined : `${offset[0]}px`,
            marginRight: anchor.includes('right') ? `${-offset[0]}px` : undefined,
            marginTop: anchor.includes('bottom') ? undefined : `${offset[1]}px`,
            marginBottom: anchor.includes('bottom') ? `${-offset[1]}px` : undefined,
            zIndex: isDragging ? 200 : isSelected ? 150 : 50,
          };

          return (
            <div
              key={mod.id}
              ref={el => { moduleRefs.current.set(mod.id, el); }}
              onPointerDown={e => onPointerDown(e, mod.id)}
              className={`hud-module flex items-center justify-center rounded-md border shadow-md ${
                isDragging
                  ? 'bg-blurple border-white/80 shadow-[0_0_30px_rgba(114,137,218,.65)] cursor-grabbing'
                  : isSelected
                    ? 'bg-glacier-darkest border-blurple cursor-grab transition-[border-color,background] duration-150'
                    : 'bg-glacier-darkest/85 border-white/10 hover:border-blurple/50 hover:bg-glacier-darker cursor-grab transition-all duration-150'
              }`}
              style={style}
              role="button"
              aria-label={`Drag ${mod.id}`}
            >
              <i className={`fas ${mod.icon} ${isDragging ? 'text-white' : 'text-glacier-muted'} text-[10px]`}></i>
              {(isDragging || isSelected) && (
                <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 pointer-events-none">
                  <span className="text-[9px] font-black text-white bg-glacier-black/95 border border-blurple/30 px-2 py-0.5 rounded-md uppercase tracking-widest whitespace-nowrap shadow-md">
                    {mod.id}
                  </span>
                </div>
              )}
            </div>
          );
        })}

        {visibleModules.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none gap-2">
            <i className="fas fa-grip-dots-vertical text-2xl text-glacier-muted/50"></i>
            <span className="text-[10px] uppercase tracking-widest text-glacier-muted/70 font-black">
              No active HUD elements
            </span>
            <span className="text-[10px] text-glacier-muted/50">Toggle modules in the config panel</span>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        <div className="flex-1 bg-glacier-black/40 rounded-xl px-4 py-2.5 border border-white/5 min-h-[44px] flex items-center">
          {selectedMod && selectedSettings ? (
            <div className="flex items-center gap-3 flex-wrap text-[10px] font-black uppercase tracking-widest">
              <span className="text-blurple"><i className={`fas ${selectedMod.icon} mr-1.5`}></i>{selectedMod.id}</span>
              <span className="text-glacier-muted">·</span>
              <span className="text-white">{(selectedSettings[selectedMod.anchorKey] as string)?.replace(/_/g, ' ')}</span>
              <span className="text-glacier-muted">·</span>
              <span className="text-glacier-muted font-mono">
                ({(selectedSettings[selectedMod.offsetKey] as [number, number])?.[0] ?? 0},
                 {(selectedSettings[selectedMod.offsetKey] as [number, number])?.[1] ?? 0})
              </span>
            </div>
          ) : (
            <span className="text-[10px] font-black uppercase tracking-widest text-glacier-muted">
              <i className="fas fa-hand-pointer mr-1.5"></i>Tap an element to select · drag to move · click a zone to snap
            </span>
          )}
        </div>
        {selectedId && (
          <button
            onClick={recenterSelected}
            className="px-4 py-2.5 rounded-xl bg-blurple/15 hover:bg-blurple/25 text-blurple border border-blurple/25 text-[10px] font-black uppercase tracking-widest transition-all"
            title="Reset offset of selected module to (0, 0)"
          >
            <i className="fas fa-crosshairs mr-1.5"></i>Reset Offset
          </button>
        )}
      </div>
    </div>
  );
};

export default HUDCanvas;
