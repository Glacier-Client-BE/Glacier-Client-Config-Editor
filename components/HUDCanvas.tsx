
import React, { useRef, useEffect, useState } from 'react';
import { ConfigData, HUDModule, AnchorType } from '../types';

interface HUDCanvasProps {
  config: ConfigData;
  modules: HUDModule[];
  onUpdate: (path: string[], value: any, skipHistory?: boolean) => void;
}

const HUDCanvas: React.FC<HUDCanvasProps> = ({ config, modules, onUpdate }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const anchors: AnchorType[] = [
    "top_left", "top_middle", "top_right",
    "left_middle", "middle", "right_middle",
    "bottom_left", "bottom_middle", "bottom_right"
  ];

  const getAnchorStyles = (anchor: AnchorType) => {
    switch (anchor) {
      case "top_left": return { top: 0, left: 0 };
      case "top_middle": return { top: 0, left: '50%', transform: 'translateX(-50%)' };
      case "top_right": return { top: 0, right: 0 };
      case "left_middle": return { top: '50%', left: 0, transform: 'translateY(-50%)' };
      case "middle": return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
      case "right_middle": return { top: '50%', right: 0, transform: 'translateY(-50%)' };
      case "bottom_left": return { bottom: 0, left: 0 };
      case "bottom_middle": return { bottom: 0, left: '50%', transform: 'translateX(-50%)' };
      case "bottom_right": return { bottom: 0, right: 0 };
      default: return { top: 0, left: 0 };
    }
  };

  const handleInteractionStart = (e: React.MouseEvent | React.TouchEvent, id: string) => {
    if (e.cancelable) e.preventDefault();
    setDraggingId(id);
    setSelectedId(id);
  };

  const snapToAnchor = (anchor: AnchorType) => {
    if (!selectedId) return;
    const mod = modules.find(m => m.id === selectedId);
    if (!mod) return;
    onUpdate(["mod_menu_config@gc.pnl", mod.anchorKey], anchor);
    onUpdate(["mod_menu_config@gc.pnl", mod.offsetKey], [0, 0]);
  };

  useEffect(() => {
    const handleMove = (clientX: number, clientY: number) => {
      if (!draggingId || !containerRef.current) return;
      const mod = modules.find(m => m.id === draggingId);
      if (!mod) return;

      const rect = containerRef.current.getBoundingClientRect();
      const rawX = clientX - rect.left;
      const rawY = clientY - rect.top;

      const clampedX = Math.max(0, Math.min(rect.width, rawX));
      const clampedY = Math.max(0, Math.min(rect.height, rawY));

      let anchorH: 'left' | 'middle' | 'right' = 'middle';
      if (clampedX < rect.width / 3) anchorH = 'left';
      else if (clampedX > (rect.width / 3) * 2) anchorH = 'right';

      let anchorV: 'top' | 'middle' | 'bottom' = 'middle';
      if (clampedY < rect.height / 3) anchorV = 'top';
      else if (clampedY > (rect.height / 3) * 2) anchorV = 'bottom';

      let newAnchor: AnchorType = "middle";
      if (anchorV === "middle" && anchorH === "middle") newAnchor = "middle";
      else if (anchorV === "middle") newAnchor = `${anchorH}_middle` as AnchorType;
      else if (anchorH === "middle") newAnchor = `${anchorV}_middle` as AnchorType;
      else newAnchor = `${anchorV}_${anchorH}` as AnchorType;

      let offsetX = 0;
      let offsetY = 0;

      if (anchorH === 'left') offsetX = clampedX;
      else if (anchorH === 'right') offsetX = -(rect.width - clampedX);
      else offsetX = clampedX - rect.width / 2;

      if (anchorV === 'top') offsetY = clampedY;
      else if (anchorV === 'bottom') offsetY = -(rect.height - clampedY);
      else offsetY = clampedY - rect.height / 2;

      onUpdate(["mod_menu_config@gc.pnl", mod.anchorKey], newAnchor, true);
      onUpdate(["mod_menu_config@gc.pnl", mod.offsetKey], [Math.round(offsetX), Math.round(offsetY)], true);
    };

    const onMouseMove = (e: MouseEvent) => handleMove(e.clientX, e.clientY);
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) handleMove(e.touches[0].clientX, e.touches[0].clientY);
    };

    const onEnd = () => {
      if (draggingId) {
        const mod = modules.find(m => m.id === draggingId);
        if (mod) {
          const modSettings = config["mod_menu_config@gc.pnl"];
          onUpdate(["mod_menu_config@gc.pnl", mod.anchorKey], modSettings[mod.anchorKey]);
        }
      }
      setDraggingId(null);
    };

    if (draggingId) {
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onEnd);
      window.addEventListener('touchmove', onTouchMove, { passive: false });
      window.addEventListener('touchend', onEnd);
    }
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onEnd);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onEnd);
    };
  }, [draggingId, modules, onUpdate, config]);

  return (
    <div className="w-full h-full flex flex-col select-none relative">
      <div 
        ref={containerRef}
        onClick={(e) => { if(e.target === containerRef.current) setSelectedId(null); }}
        className="w-full aspect-video bg-black/40 border-2 border-white/10 rounded-3xl relative overflow-hidden shadow-2xl touch-none flex-shrink-0"
      >
        <div className="absolute inset-0 bg-[radial-gradient(#7289da_1px,transparent_1px)] [background-size:20px_20px] opacity-[0.03] pointer-events-none"></div>
        
        {selectedId && !draggingId && (
          <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 p-4 gap-4 pointer-events-none z-[100]">
            {anchors.map(anchor => (
              <button
                key={anchor}
                onClick={() => snapToAnchor(anchor)}
                className="pointer-events-auto bg-[#7289da]/5 border border-[#7289da]/10 rounded-2xl hover:bg-[#7289da]/20 hover:border-[#7289da]/40 transition-all flex items-center justify-center group/snap"
              >
                <i className="fas fa-plus text-[#7289da] opacity-0 group-hover/snap:opacity-60 transition-all scale-75 group-hover/snap:scale-100"></i>
              </button>
            ))}
          </div>
        )}

        {modules.map(mod => {
          const modSettings = config["mod_menu_config@gc.pnl"];
          if (!modSettings || !modSettings[mod.toggleKey]) return null;

          const anchor = modSettings[mod.anchorKey] as AnchorType;
          const offset = modSettings[mod.offsetKey] as [number, number] || [0, 0];
          const anchorStyle = getAnchorStyles(anchor);
          const isDragging = draggingId === mod.id;
          const isSelected = selectedId === mod.id;

          const style: React.CSSProperties = {
            ...anchorStyle,
            position: 'absolute',
            width: `${mod.width}px`,
            height: `${mod.height}px`,
            marginLeft: (anchor.includes('left') || anchor.includes('middle')) && !anchor.includes('right') ? `${offset[0]}px` : undefined,
            marginRight: anchor.includes('right') ? `${-offset[0]}px` : undefined,
            marginTop: (anchor.includes('top') || (anchor.includes('middle') && !anchor.includes('bottom'))) ? `${offset[1]}px` : undefined,
            marginBottom: anchor.includes('bottom') ? `${-offset[1]}px` : undefined,
            zIndex: isDragging ? 200 : (isSelected ? 150 : 50),
          };

          return (
            <div
              key={mod.id}
              onMouseDown={(e) => handleInteractionStart(e, mod.id)}
              onTouchStart={(e) => handleInteractionStart(e, mod.id)}
              className={`flex items-center justify-center rounded-lg border shadow-lg transition-transform ${
                isDragging 
                  ? 'bg-[#7289da] border-white scale-125 shadow-[0_0_40px_rgba(114,137,218,0.6)] cursor-grabbing' 
                  : isSelected 
                    ? 'bg-[#282b30] border-[#7289da] scale-110 cursor-grab' 
                    : 'bg-[#282b30]/80 border-white/10 hover:border-[#7289da]/40 cursor-grab'
              }`}
              style={style}
            >
              <i className={`fas ${mod.icon} ${isDragging ? 'text-white' : 'text-zinc-500'} text-[10px]`}></i>
              <div className={`absolute -bottom-8 left-1/2 -translate-x-1/2 transition-opacity duration-300 pointer-events-none ${isDragging || isSelected ? 'opacity-100' : 'opacity-0'}`}>
                <span className="text-[8px] font-black text-white bg-[#1e2124] border border-white/10 px-2 py-1 rounded-md uppercase tracking-widest whitespace-nowrap shadow-2xl">
                   {mod.id}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      
      <div className="mt-4 bg-[#1e2124]/30 rounded-3xl p-4 border border-white/5 overflow-hidden">
        <div className="flex flex-wrap gap-4 text-[9px] text-zinc-500 font-black uppercase tracking-widest justify-center">
          <div className="flex items-center gap-2"><div className="w-1 h-1 rounded-full bg-[#7289da]"></div> DRAG ELEMENTS</div>
          <div className="flex items-center gap-2"><div className="w-1 h-1 rounded-full bg-[#7289da]"></div> CLICK TO SNAP</div>
          <div className="flex items-center gap-2"><div className="w-1 h-1 rounded-full bg-[#7289da]"></div> CTRL+Z UNDO</div>
        </div>
      </div>
    </div>
  );
};

export default HUDCanvas;
