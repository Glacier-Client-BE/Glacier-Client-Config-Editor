import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AnchorType, ConfigData, HUDModule } from '../types';

export interface DragPreview {
  id: string;
  anchor: AnchorType;
  offset: [number, number];
}

interface DragState {
  id: string;
  pointerId: number;
  // Pointer's offset *inside* the module, in reference-space pixels.
  pointerOffsetX: number;
  pointerOffsetY: number;
  moduleW: number;
  moduleH: number;
  startClientX: number;
  startClientY: number;
  moved: boolean;
  capturedTarget: Element | null;
}

const computeAnchorAndOffset = (
  x: number,
  y: number,
  w: number,
  h: number,
  cw: number,
  ch: number,
): { anchor: AnchorType; offset: [number, number] } => {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const hZone: 'left' | 'middle' | 'right' = cx < cw / 3 ? 'left' : cx > (cw * 2) / 3 ? 'right' : 'middle';
  const vZone: 'top' | 'middle' | 'bottom' = cy < ch / 3 ? 'top' : cy > (ch * 2) / 3 ? 'bottom' : 'middle';
  let anchor: AnchorType;
  if (vZone === 'middle' && hZone === 'middle') anchor = 'middle';
  else if (vZone === 'middle') anchor = `${hZone}_middle` as AnchorType;
  else if (hZone === 'middle') anchor = `${vZone}_middle` as AnchorType;
  else anchor = `${vZone}_${hZone}` as AnchorType;
  let ox: number, oy: number;
  if (hZone === 'left') ox = x;
  else if (hZone === 'right') ox = x - (cw - w);
  else ox = x - (cw - w) / 2;
  if (vZone === 'top') oy = y;
  else if (vZone === 'bottom') oy = y - (ch - h);
  else oy = y - (ch - h) / 2;
  return { anchor, offset: [Math.round(ox), Math.round(oy)] };
};

interface UseHUDDragOpts {
  containerRef: React.RefObject<HTMLDivElement>;
  modules: HUDModule[];
  settings: Record<string, any> | undefined;
  defaults: Record<string, any> | undefined;
  scale: number;
  section: string;
  onUpdate: (path: string[], value: any, skipHistory?: boolean) => void;
}

const MOVE_THRESHOLD_PX = 3;

export function useHUDDrag({ containerRef, modules, settings, defaults, scale, section, onUpdate }: UseHUDDragOpts) {
  const dragRef = useRef<DragState | null>(null);
  const lastPointer = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const rafRef = useRef<number | null>(null);
  const scaleRef = useRef(scale);
  const settingsRef = useRef(settings);
  const modulesRef = useRef(modules);
  const defaultsRef = useRef(defaults);

  const [drag, setDrag] = useState<DragPreview | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Mirror reactive deps into refs so the global listeners read live values without re-binding.
  useEffect(() => { scaleRef.current = scale; }, [scale]);
  useEffect(() => { settingsRef.current = settings; }, [settings]);
  useEffect(() => { modulesRef.current = modules; }, [modules]);
  useEffect(() => { defaultsRef.current = defaults; }, [defaults]);

  // Convert a pointer event's clientX/Y into reference-space coordinates inside the canvas,
  // accounting for the module's grab offset. Reads the rect *live* every call.
  const pointerToRefSpace = useCallback((clientX: number, clientY: number, d: DragState) => {
    const el = containerRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const sx = scaleRef.current || 1;
    const cw = rect.width / sx;
    const ch = rect.height / sx;
    const rawX = (clientX - rect.left) / sx - d.pointerOffsetX;
    const rawY = (clientY - rect.top) / sx - d.pointerOffsetY;
    const x = Math.max(0, Math.min(cw - d.moduleW, rawX));
    const y = Math.max(0, Math.min(ch - d.moduleH, rawY));
    return { x, y, cw, ch };
  }, [containerRef]);

  const releaseCapture = (d: DragState) => {
    const tgt = d.capturedTarget as any;
    if (tgt && typeof tgt.releasePointerCapture === 'function') {
      try { tgt.releasePointerCapture(d.pointerId); } catch { /* ignore */ }
    }
  };

  const onModulePointerDown = useCallback((e: React.PointerEvent, mod: HUDModule) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (!settingsRef.current) return;
    e.preventDefault();
    e.stopPropagation();

    const target = e.currentTarget as HTMLElement;
    try { target.setPointerCapture(e.pointerId); } catch { /* some browsers throw if already captured */ }

    const moduleRect = target.getBoundingClientRect();
    const sx = scaleRef.current || 1;

    dragRef.current = {
      id: mod.id,
      pointerId: e.pointerId,
      pointerOffsetX: (e.clientX - moduleRect.left) / sx,
      pointerOffsetY: (e.clientY - moduleRect.top) / sx,
      moduleW: mod.width,
      moduleH: mod.height,
      startClientX: e.clientX,
      startClientY: e.clientY,
      moved: false,
      capturedTarget: target,
    };
    lastPointer.current = { x: e.clientX, y: e.clientY };

    const cur = settingsRef.current;
    const currentAnchor = (cur[mod.anchorKey] as AnchorType) || 'top_left';
    const currentOffset = (cur[mod.offsetKey] as [number, number]) || [0, 0];
    setSelectedId(mod.id);
    setDrag({ id: mod.id, anchor: currentAnchor, offset: currentOffset });
  }, []);

  // Global pointer listeners — bound once. They read live state via refs and the live container rect.
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d || d.pointerId !== e.pointerId) return;
      lastPointer.current = { x: e.clientX, y: e.clientY };
      if (!d.moved) {
        const dx = Math.abs(e.clientX - d.startClientX);
        const dy = Math.abs(e.clientY - d.startClientY);
        if (dx > MOVE_THRESHOLD_PX || dy > MOVE_THRESHOLD_PX) d.moved = true;
      }
      if (rafRef.current != null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        const cur = dragRef.current;
        if (!cur) return;
        const p = pointerToRefSpace(lastPointer.current.x, lastPointer.current.y, cur);
        if (!p) return;
        const { anchor, offset } = computeAnchorAndOffset(p.x, p.y, cur.moduleW, cur.moduleH, p.cw, p.ch);
        setDrag({ id: cur.id, anchor, offset });
      });
    };

    const finish = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d || d.pointerId !== e.pointerId) return;
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (d.moved) {
        const p = pointerToRefSpace(e.clientX, e.clientY, d);
        if (p) {
          const { anchor, offset } = computeAnchorAndOffset(p.x, p.y, d.moduleW, d.moduleH, p.cw, p.ch);
          const mod = modulesRef.current.find(m => m.id === d.id);
          if (mod) {
            onUpdate([section, mod.anchorKey], anchor);
            onUpdate([section, mod.offsetKey], offset, true);
          }
        }
      }
      releaseCapture(d);
      dragRef.current = null;
      setDrag(null);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [pointerToRefSpace, onUpdate, section]);

  const snapToAnchor = useCallback((anchor: AnchorType) => {
    if (!selectedId) return;
    const mod = modulesRef.current.find(m => m.id === selectedId);
    if (!mod) return;
    onUpdate([section, mod.anchorKey], anchor);
    onUpdate([section, mod.offsetKey], [0, 0], true);
  }, [selectedId, onUpdate, section]);

  // Restore the selected module to the version's default anchor + offset.
  // Falls back to top_left / [0,0] if the version has no default for this module.
  const recenterSelected = useCallback(() => {
    if (!selectedId) return;
    const mod = modulesRef.current.find(m => m.id === selectedId);
    if (!mod) return;
    const defs = defaultsRef.current;
    const defaultAnchor = (defs?.[mod.anchorKey] as AnchorType) || 'top_left';
    const defaultOffset = (defs?.[mod.offsetKey] as [number, number]) || [0, 0];
    onUpdate([section, mod.anchorKey], defaultAnchor);
    onUpdate([section, mod.offsetKey], defaultOffset, true);
  }, [selectedId, onUpdate, section]);

  return {
    drag,
    selectedId,
    setSelectedId,
    onModulePointerDown,
    snapToAnchor,
    recenterSelected,
  };
}
