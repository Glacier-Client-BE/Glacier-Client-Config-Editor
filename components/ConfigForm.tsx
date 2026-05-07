import React, { useState, useMemo, useCallback, memo, useDeferredValue } from 'react';
import { ConfigData } from '../types';

interface ConfigFormProps {
  config: ConfigData;
  activeSection: string;
  onUpdate: (path: string[], value: any) => void;
}

const formatLabel = (key: string) =>
  key.replace('$', '').replace(/_|\|default/g, ' ').trim();

interface ControlProps {
  section: string;
  configKey: string;
  value: any;
  isChild?: boolean;
  onUpdate: (path: string[], value: any) => void;
}

const wrapClass = (isChild: boolean) =>
  isChild
    ? 'py-2.5 pl-3 border-l-2 border-blurple/15 ml-1'
    : 'bg-glacier-black/30 border border-white/5 rounded-xl p-3.5 mb-2';

const ToggleControl: React.FC<ControlProps & { value: boolean }> = memo(({ section, configKey, value, isChild, onUpdate }) => (
  <div className={`flex items-center justify-between ${wrapClass(!!isChild)}`}>
    <label className="text-sm font-bold text-zinc-100 pr-3 truncate">{formatLabel(configKey)}</label>
    <button
      onClick={() => onUpdate([section, configKey], !value)}
      className={`w-11 h-6 rounded-full p-1 transition-colors relative flex items-center flex-shrink-0 focus-ring ${value ? 'bg-blurple shadow-[0_0_8px_rgba(114,137,218,.5)]' : 'bg-glacier-dark'}`}
      aria-label={`Toggle ${formatLabel(configKey)}`}
      aria-pressed={value}
    >
      <span className={`toggle-knob w-4 h-4 bg-white rounded-full shadow ${value ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  </div>
));

const OpacityControl: React.FC<ControlProps & { value: number }> = memo(({ section, configKey, value, isChild, onUpdate }) => (
  <div className={wrapClass(!!isChild)}>
    <div className="flex justify-between items-center mb-2">
      <label className="text-[10px] font-black text-blurple uppercase tracking-widest">{formatLabel(configKey)}</label>
      <span className="text-[10px] font-mono font-bold text-zinc-300 bg-glacier-black/70 px-2 py-0.5 rounded-md">{Math.round(value * 100)}%</span>
    </div>
    <input
      type="range"
      min={0}
      max={1}
      step={0.01}
      value={value}
      onChange={e => onUpdate([section, configKey], parseFloat(e.target.value))}
      className="w-full"
      aria-label={`${formatLabel(configKey)} slider`}
    />
  </div>
));

const ArrayControl: React.FC<ControlProps & { value: [number, number] }> = memo(({ section, configKey, value, isChild, onUpdate }) => {
  const isSize = configKey.includes('size');
  return (
    <div className={wrapClass(!!isChild)}>
      <label className="block text-[10px] font-black text-glacier-muted uppercase mb-2 tracking-widest">{formatLabel(configKey)}</label>
      <div className="flex gap-2">
        <div className="flex-1 flex items-center bg-glacier-black/70 border border-white/5 hover:border-blurple/30 focus-within:border-blurple/50 transition-colors rounded-lg px-3 py-2">
          <span className="text-[10px] font-black text-blurple/80 mr-2 w-3">{isSize ? 'W' : 'X'}</span>
          <input
            type="number"
            value={value[0]}
            onChange={e => onUpdate([section, configKey], [parseFloat(e.target.value) || 0, value[1]])}
            className="w-full bg-transparent text-xs text-zinc-100 focus:outline-none font-mono"
          />
        </div>
        <div className="flex-1 flex items-center bg-glacier-black/70 border border-white/5 hover:border-blurple/30 focus-within:border-blurple/50 transition-colors rounded-lg px-3 py-2">
          <span className="text-[10px] font-black text-blurple/80 mr-2 w-3">{isSize ? 'H' : 'Y'}</span>
          <input
            type="number"
            value={value[1]}
            onChange={e => onUpdate([section, configKey], [value[0], parseFloat(e.target.value) || 0])}
            className="w-full bg-transparent text-xs text-zinc-100 focus:outline-none font-mono"
          />
        </div>
      </div>
    </div>
  );
});

const NumberControl: React.FC<ControlProps & { value: number }> = memo(({ section, configKey, value, isChild, onUpdate }) => (
  <div className={wrapClass(!!isChild)}>
    <label className="block text-[10px] font-black text-glacier-muted uppercase mb-2 tracking-widest">{formatLabel(configKey)}</label>
    <input
      type="number"
      value={value}
      onChange={e => onUpdate([section, configKey], parseFloat(e.target.value) || 0)}
      className="w-full bg-glacier-black/70 border border-white/5 rounded-lg px-3 py-2.5 text-xs text-zinc-100 focus:outline-none focus:border-blurple/50 hover:border-blurple/30 transition-colors font-mono"
    />
  </div>
));

const StringControl: React.FC<ControlProps & { value: string }> = memo(({ section, configKey, value, isChild, onUpdate }) => (
  <div className={wrapClass(!!isChild)}>
    <label className="block text-[10px] font-black text-glacier-muted uppercase mb-2 tracking-widest">{formatLabel(configKey)}</label>
    <input
      type="text"
      value={value}
      onChange={e => onUpdate([section, configKey], e.target.value)}
      className="w-full bg-glacier-black/70 border border-white/5 rounded-lg px-3 py-2.5 text-xs text-zinc-100 focus:outline-none focus:border-blurple/50 hover:border-blurple/30 transition-colors font-mono"
    />
  </div>
));

const renderControl = (section: string, key: string, value: any, isChild: boolean, onUpdate: (path: string[], value: any) => void) => {
  if (Array.isArray(value) && value.length === 2) return <ArrayControl key={key} section={section} configKey={key} value={value as [number, number]} isChild={isChild} onUpdate={onUpdate} />;
  if (typeof value === 'boolean') return <ToggleControl key={key} section={section} configKey={key} value={value} isChild={isChild} onUpdate={onUpdate} />;
  if (key.includes('opacity') && typeof value === 'number') return <OpacityControl key={key} section={section} configKey={key} value={value} isChild={isChild} onUpdate={onUpdate} />;
  if (typeof value === 'number') return <NumberControl key={key} section={section} configKey={key} value={value} isChild={isChild} onUpdate={onUpdate} />;
  if (typeof value === 'string') return <StringControl key={key} section={section} configKey={key} value={value} isChild={isChild} onUpdate={onUpdate} />;
  return null;
};

const SYNTHETIC_RULES: Array<{ id: string; pattern: string }> = [
  { id: 'bossbar', pattern: 'boss' },
  { id: 'scoreboard', pattern: 'scoreboard' },
  { id: 'crosshair', pattern: 'crosshair' },
  { id: 'exp_bar', pattern: 'xp_bar' },
  { id: 'exp_bar', pattern: 'xp_percentage' },
  { id: 'saturation_display', pattern: 'display' },
  { id: 'saturation_display', pattern: 'saturation' },
  { id: 'saturation_display', pattern: 'nightshift' },
  { id: 'text_visibility', pattern: 'hide_item_name' },
  { id: 'text_visibility', pattern: 'hide_jukebox' },
  { id: 'text_visibility', pattern: 'hide_tip' },
  { id: 'text_visibility', pattern: 'hide_actionbar' },
];

const DEBUG_KEYWORDS = ['glacierversion', 'version', 'os_type', 'graphics', 'platform', 'ui_type', 'world_type', 'world_name', 'day_counter', 'moon_phase', 'gamemode', 'xp_level', 'item_id', 'item_aux_id'];

const matchChildren = (base: string, root: string, keys: string[]): string[] => {
  switch (base) {
    case 'coordinates':
      return keys.filter(k => k !== root && (
        k.startsWith('$coordinates_') ||
        /vanillacordinates|chunk_coordinates|nether_coordinates|nether_in_overworld|show_chunkcoordinates|show_nethercoordinates|hide_chunkcoordinates|hide_nethercoordinates|hide_vanillacordinates/.test(k)
      ));
    case 'itemcounters':
      return keys.filter(k => k !== root && /hide_potioncounter|hide_totemcounter|hide_arrowcounter/.test(k));
    case 'clockcompass':
      return keys.filter(k => k !== root && (
        k.startsWith('$clockcompass_') || /compass_aux|clock_aux|recovery_compass_aux|show_clock_compass/.test(k)
      ));
    case 'mobileshortcuts':
      return keys.filter(k => k !== root && /f1button|f8button|hotbar_left_button|hotbar_right_button/.test(k));
    case 'mainhandhud':
      return keys.filter(k => k !== root && (
        k.startsWith('$mainhandhud_') || /mainhand_durability_toggle_index|hide_mainhandhud|mainhandhud_slot_opacity/.test(k)
      ));
    case 'chunkmap':
      return keys.filter(k => k !== root && (
        k.startsWith('$chunkmap_') || /hide_slime_chunks|chunkmap_chunk_position/.test(k)
      ));
    case 'playerlist':
      return keys.filter(k => k !== root && (
        k.startsWith('$playerlist_') || /hide_playeravatars|playerlist_mobile_button/.test(k)
      ));
    case 'hotbar':
      return keys.filter(k => k !== root && (
        k.startsWith('$hotbar_') || /hide_hotbar|hide_inventory_button|show_hotbar_numbers|hotbar_toggle_index/.test(k)
      ));
    default:
      return keys.filter(k => k !== root && (
        k.startsWith(`${root}_`) ||
        k.startsWith(`$hide_${base}`) ||
        k.startsWith(`$show_${base}`)
      ));
  }
};

const ConfigForm: React.FC<ConfigFormProps> = ({ config, activeSection, onUpdate }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const deferredSearch = useDeferredValue(searchTerm);
  const search = deferredSearch.trim().toLowerCase();

  const toggleGroup = useCallback((groupId: string) => {
    setExpandedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  }, []);

  const { groups, standalones } = useMemo(() => {
    const sectionData = config[activeSection];
    if (!sectionData) return { groups: {} as Record<string, { root: string; children: string[] }>, standalones: [] as string[] };

    const keys = Object.keys(sectionData);
    const groups: Record<string, { root: string; children: string[] }> = {};
    const processed = new Set<string>();

    const roots = keys.filter(k => k.startsWith('$') && typeof sectionData[k] === 'boolean' && !k.includes('_'));
    for (const root of roots) {
      const base = root.substring(1);
      const children = matchChildren(base, root, keys);
      groups[base] = { root, children };
      for (const c of children) processed.add(c);
      processed.add(root);
    }

    for (const rule of SYNTHETIC_RULES) {
      const matches = keys.filter(k => !processed.has(k) && k.toLowerCase().includes(rule.pattern));
      if (matches.length === 0) continue;
      const existing = groups[rule.id] || { root: '', children: [] };
      const merged = new Set([...existing.children, ...matches]);
      existing.children = Array.from(merged);
      groups[rule.id] = existing;
      for (const k of matches) processed.add(k);
    }

    if (keys.includes('$debughud')) {
      const debugChildren = keys.filter(k => !processed.has(k) && DEBUG_KEYWORDS.some(d => k.includes(d)));
      const current = groups['debughud'] || { root: '$debughud', children: [] };
      const merged = new Set([...current.children, ...debugChildren]);
      current.children = Array.from(merged);
      groups['debughud'] = current;
      for (const k of debugChildren) processed.add(k);
      processed.add('$debughud');
    }

    const standalones = keys.filter(k => !processed.has(k));
    return { groups, standalones };
  }, [config, activeSection]);

  const sectionData = config[activeSection];

  const filteredGroupEntries = useMemo(() => {
    const entries = Object.entries(groups) as Array<[string, { root: string; children: string[] }]>;
    if (!search) return entries;
    return entries.filter(([id, data]) =>
      id.toLowerCase().includes(search) ||
      data.children.some(c => c.toLowerCase().includes(search))
    );
  }, [groups, search]);

  const filteredStandalones = useMemo(() => {
    if (!search) return standalones;
    return standalones.filter(k => k.toLowerCase().includes(search));
  }, [standalones, search]);

  const totalCount = filteredGroupEntries.length + filteredStandalones.length;

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-h-0">
      <div className="relative mb-4">
        <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-glacier-muted text-xs pointer-events-none"></i>
        <input
          type="text"
          placeholder="Search modules..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="w-full bg-glacier-black/70 border border-white/5 hover:border-blurple/30 focus:border-blurple/50 rounded-full pl-10 pr-10 py-3 text-xs font-bold focus:outline-none transition-colors placeholder:text-glacier-muted/60"
          aria-label="Search modules"
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white/5 hover:bg-white/15 text-glacier-muted hover:text-white text-[10px] transition-all"
            aria-label="Clear search"
          >
            <i className="fas fa-times"></i>
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 -mr-1 min-h-0">
        <div className="space-y-2.5 pb-2">
          {filteredGroupEntries.map(([groupId, data]) => {
            const isEnabled = data.root ? sectionData[data.root] === true : true;
            const isExpanded = !!expandedGroups[groupId];

            return (
              <div key={groupId} className="bg-glacier-black/30 border border-white/5 rounded-2xl overflow-hidden hover:border-blurple/20 transition-colors">
                <div
                  onClick={() => toggleGroup(groupId)}
                  className="w-full p-4 flex items-center justify-between cursor-pointer focus-ring rounded-2xl"
                  role="button"
                  tabIndex={0}
                  aria-expanded={isExpanded}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleGroup(groupId); } }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {data.root && (
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); onUpdate([activeSection, data.root], !isEnabled); }}
                        role="switch"
                        aria-checked={isEnabled}
                        aria-label={`Toggle ${groupId.replace(/_/g, ' ')}`}
                        className={`rounded-full p-0.5 transition-colors flex items-center flex-shrink-0 ${isEnabled ? 'bg-blurple shadow-[0_0_8px_rgba(114,137,218,.5)]' : 'bg-glacier-dark'}`}
                        style={{ height: '22px', width: '40px' }}
                      >
                        <span className={`toggle-knob block w-4 h-4 bg-white rounded-full shadow ${isEnabled ? 'translate-x-[18px]' : 'translate-x-0'}`} />
                      </button>
                    )}
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-black uppercase tracking-widest text-zinc-100 truncate">{groupId.replace(/_/g, ' ')}</span>
                      <span className="text-[10px] text-glacier-muted font-bold uppercase mt-0.5">{data.children.length} {data.children.length === 1 ? 'parameter' : 'parameters'}</span>
                    </div>
                  </div>
                  <i className={`fas fa-chevron-down text-glacier-muted text-[10px] transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}></i>
                </div>

                {isExpanded && (
                  <div className="px-3 pb-3 pt-1 border-t border-white/5 bg-black/20 anim-fade-in">
                    {isEnabled ? (
                      <div className="space-y-1">
                        {data.children.map(childKey => renderControl(activeSection, childKey, sectionData[childKey], true, onUpdate))}
                      </div>
                    ) : (
                      <div className="py-5 text-center">
                        <i className="fas fa-lock text-glacier-muted/50 text-sm"></i>
                        <p className="text-[10px] text-glacier-muted/70 font-black uppercase tracking-widest italic mt-2">Enable module to customize</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {filteredStandalones.map(k => renderControl(activeSection, k, sectionData[k], false, onUpdate))}

          {totalCount === 0 && (
            <div className="py-12 text-center">
              <i className="fas fa-magnifying-glass text-glacier-muted/40 text-2xl"></i>
              <p className="text-[11px] text-glacier-muted font-bold mt-3">No matches for "{searchTerm}"</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default memo(ConfigForm);
