
import React, { useState, useMemo } from 'react';
import { ConfigData } from '../types';

interface ConfigFormProps {
  config: ConfigData;
  activeSection: string;
  onUpdate: (path: string[], value: any) => void;
}

const ConfigForm: React.FC<ConfigFormProps> = ({ config, activeSection, onUpdate }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const renderSingleControl = (section: string, key: string, value: any, isChild = false) => {
    if (Array.isArray(value) && value.length === 2) {
      const isSize = key.includes('size');
      return (
        <div key={key} className={`py-3 group/item ${isChild ? 'pl-4 border-l border-white/5' : 'bg-[#1e2124]/30 border border-white/5 rounded-2xl p-4 mb-2'}`}>
          <label className="block text-[9px] font-black text-zinc-500 uppercase mb-2 tracking-widest">
            {key.replace('$', '').replace(/_|\|default/g, ' ')}
          </label>
          <div className="flex gap-2">
            <div className="flex-1 flex items-center bg-[#1e2124] border border-white/5 rounded-xl px-3 py-2">
              <span className="text-[9px] font-black text-zinc-600 mr-2">{isSize ? 'W' : 'X'}</span>
              <input
                type="number"
                value={value[0]}
                onChange={(e) => onUpdate([section, key], [parseFloat(e.target.value) || 0, value[1]])}
                className="w-full bg-transparent text-xs text-zinc-200 focus:outline-none font-mono"
              />
            </div>
            <div className="flex-1 flex items-center bg-[#1e2124] border border-white/5 rounded-xl px-3 py-2">
              <span className="text-[9px] font-black text-zinc-600 mr-2">{isSize ? 'H' : 'Y'}</span>
              <input
                type="number"
                value={value[1]}
                onChange={(e) => onUpdate([section, key], [value[0], parseFloat(e.target.value) || 0])}
                className="w-full bg-transparent text-xs text-zinc-200 focus:outline-none font-mono"
              />
            </div>
          </div>
        </div>
      );
    }

    if (typeof value === 'boolean') {
      return (
        <div key={key} className={`flex items-center justify-between py-3 group/item ${isChild ? 'pl-4 border-l border-white/5' : 'bg-[#1e2124]/30 border border-white/5 rounded-2xl p-4 mb-2'}`}>
          <div className="flex flex-col pr-4">
            <label className="text-sm font-bold text-zinc-100 group-hover/item:text-white transition-colors">
              {key.replace('$', '').replace(/_|\|default/g, ' ')}
            </label>
          </div>
          <button
            onClick={() => onUpdate([section, key], !value)}
            className={`w-11 h-6 rounded-full p-1 transition-all relative flex items-center flex-shrink-0 ${value ? 'bg-[#7289da]' : 'bg-[#424549]'}`}
          >
            <div className={`w-4 h-4 bg-white rounded-full transition-all shadow-md ${value ? 'translate-x-5' : 'translate-x-0'}`} />
          </button>
        </div>
      );
    }

    if (key.includes('opacity') && typeof value === 'number') {
      return (
        <div key={key} className={`py-3 group/item ${isChild ? 'pl-4 border-l border-white/5' : 'bg-[#1e2124]/30 border border-white/5 rounded-2xl p-4 mb-2'}`}>
          <div className="flex justify-between mb-2">
            <label className="text-[9px] font-black text-[#7289da] uppercase tracking-[0.2em]">{key.replace('$', '').replace(/_opacity.*|default/g, ' Opacity')}</label>
            <span className="text-[10px] font-mono font-bold text-zinc-400">{Math.round(value * 100)}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={value}
            onChange={(e) => onUpdate([section, key], parseFloat(e.target.value))}
            className="w-full h-1.5 appearance-none bg-[#1e2124] rounded-full accent-[#7289da]"
          />
        </div>
      );
    }

    if (typeof value === 'number' || typeof value === 'string') {
      return (
        <div key={key} className={`py-3 group/item ${isChild ? 'pl-4 border-l border-white/5' : 'bg-[#1e2124]/30 border border-white/5 rounded-2xl p-4 mb-2'}`}>
          <label className="block text-[9px] font-black text-zinc-500 uppercase mb-2 tracking-widest">
            {key.replace('$', '').replace(/_|\|default/g, ' ')}
          </label>
          <input
            type={typeof value === 'number' ? 'number' : 'text'}
            value={value}
            onChange={(e) => onUpdate([section, key], typeof value === 'number' ? parseFloat(e.target.value) : e.target.value)}
            className="w-full bg-[#1e2124] border border-white/5 rounded-xl px-4 py-3 text-xs text-zinc-200 focus:outline-none focus:border-[#7289da]/40 transition-all font-mono shadow-inner"
          />
        </div>
      );
    }

    return null;
  };

  const { groups, standalones } = useMemo(() => {
    const sectionData = config[activeSection];
    if (!sectionData) return { groups: {}, standalones: [] };

    const keys = Object.keys(sectionData);
    const groups: Record<string, { root: string, children: string[] }> = {};
    const processedKeys = new Set<string>();

    // Priority 1: Boolean Roots ($key)
    const roots = keys.filter(k => k.startsWith('$') && typeof sectionData[k] === 'boolean' && !k.includes('_'));

    roots.forEach(root => {
      const base = root.substring(1);
      let children: string[] = [];

      if (base === 'coordinates') {
        children = keys.filter(k => k !== root && (
          k.startsWith('$coordinates_') ||
          k.includes('vanillacordinates') ||
          k.includes('chunk_coordinates') ||
          k.includes('nether_coordinates') ||
          k.includes('nether_in_overworld') ||
          k.includes('show_chunkcoordinates') ||
          k.includes('show_nethercoordinates') ||
          k.includes('hide_chunkcoordinates') ||
          k.includes('hide_nethercoordinates') ||
          k.includes('hide_vanillacordinates')
        ));
      } else if (base === 'clockcompass') {
        children = keys.filter(k => k !== root && (
          k.startsWith('$clockcompass_') || k.includes('compass_aux') || k.includes('clock_aux') || k.includes('recovery_compass_aux') || k.includes('show_clock_compass')
        ));
      } else if (base === 'mobileshortcuts') {
        children = keys.filter(k => k !== root && (
          k.includes('f1button') || k.includes('f8button') || k.includes('hotbar_left_button') || k.includes('hotbar_right_button')
        ));
      } else if (base === 'mainhandhud') {
        children = keys.filter(k => k !== root && (
          k.startsWith('$mainhandhud_') || k.includes('mainhand_durability_toggle_index') || k.includes('hide_mainhandhud') || k.includes('mainhandhud_slot_opacity')
        ));
      } else if (base === 'chunkmap') {
        children = keys.filter(k => k !== root && (
          k.startsWith('$chunkmap_') || k.includes('hide_slime_chunks') || k.includes('chunkmap_chunk_position')
        ));
      } else if (base === 'playerlist') {
        children = keys.filter(k => k !== root && (
          k.startsWith('$playerlist_') || k.includes('hide_playeravatars') || k.includes('playerlist_mobile_button')
        ));
      } else if (base === 'hotbar') {
        children = keys.filter(k => k !== root && (
          k.startsWith('$hotbar_') || k.includes('hide_hotbar') || k.includes('hide_inventory_button') || k.includes('show_hotbar_numbers') || k.includes('hotbar_toggle_index')
        ));
      } else {
        children = keys.filter(k => k !== root && (
          k.startsWith(`${root}_`) ||
          k.startsWith(`$hide_${base}`) ||
          k.startsWith(`$show_${base}`)
        ));
      }

      groups[base] = { root, children };
      children.forEach(k => processedKeys.add(k));
      processedKeys.add(root);
    });

    // Priority 2: Synthetic Groups
    const syntheticRules = [
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

    syntheticRules.forEach(rule => {
      const matches = keys.filter(k => !processedKeys.has(k) && k.toLowerCase().includes(rule.pattern));
      if (matches.length > 0) {
        const existing = groups[rule.id] || { root: '', children: [] };
        existing.children = [...new Set([...existing.children, ...matches])];
        groups[rule.id] = existing;
        matches.forEach(k => processedKeys.add(k));
      }
    });

    // Priority 3: Debug HUD
    if (keys.includes('$debughud')) {
      const debugList = ['glacierversion', 'version', 'os_type', 'graphics', 'platform', 'ui_type', 'world_type', 'world_name', 'day_counter', 'moon_phase', 'gamemode', 'xp_level', 'item_id', 'item_aux_id'];
      const debugChildren = keys.filter(k => !processedKeys.has(k) && debugList.some(d => k.includes(d)));
      const currentDebugGroup = groups['debughud'] || { root: '$debughud', children: [] };
      currentDebugGroup.children = [...new Set([...currentDebugGroup.children, ...debugChildren])];
      groups['debughud'] = currentDebugGroup;
      debugChildren.forEach(k => processedKeys.add(k));
      processedKeys.add('$debughud');
    }

    const standalones = keys.filter(k => !processedKeys.has(k));
    return { groups, standalones };
  }, [config, activeSection]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="relative mb-6">
        <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 text-xs"></i>
        <input
          type="text"
          placeholder="Search modules..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-[#1e2124] border border-white/5 rounded-2xl pl-10 pr-4 py-4 text-xs font-bold focus:outline-none focus:border-[#7289da]/40 transition-all placeholder:text-zinc-600"
        />
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
        <div className="space-y-3 pb-4">
          {Object.entries(groups).map(([groupId, data]) => {
            const isEnabled = data.root ? config[activeSection][data.root] === true : true;
            const isExpanded = expandedGroups[groupId] || false;
            const matchesSearch = groupId.toLowerCase().includes(searchTerm.toLowerCase()) ||
              data.children.some(c => c.toLowerCase().includes(searchTerm.toLowerCase()));

            if (searchTerm && !matchesSearch) return null;

            return (
              <div key={groupId} className="bg-[#1e2124]/30 border border-white/5 rounded-3xl overflow-hidden transition-all hover:bg-[#1e2124]/50 shadow-lg">
                <div className="p-5 flex items-center justify-between cursor-pointer" onClick={() => toggleGroup(groupId)}>
                  <div className="flex items-center gap-4">
                    {data.root && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onUpdate([activeSection, data.root], !isEnabled); }}
                        className={`w-11 h-6 rounded-full p-1 transition-all relative flex items-center ${isEnabled ? 'bg-[#7289da]' : 'bg-[#424549]'}`}
                      >
                        <div className={`w-4 h-4 bg-white rounded-full transition-all shadow-md ${isEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                      </button>
                    )}
                    <div className="flex flex-col">
                      <span className="text-xs font-black uppercase tracking-widest text-zinc-200">{groupId.replace(/_/g, ' ')}</span>
                      <span className="text-[9px] text-zinc-500 font-black uppercase mt-0.5">{data.children.length} Parameters</span>
                    </div>
                  </div>
                  <i className={`fas fa-chevron-down text-zinc-600 text-[10px] transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}></i>
                </div>

                {isExpanded && (
                  <div className="px-4 pb-4 pt-1 border-t border-white/5 bg-black/10 space-y-1">
                    {isEnabled ? (
                      data.children.map(childKey => renderSingleControl(activeSection, childKey, config[activeSection][childKey], true))
                    ) : (
                      <div className="py-6 text-center">
                        <span className="text-[9px] text-zinc-600 font-black uppercase tracking-[0.2em] italic">Enable module to customize</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {standalones
            .filter(k => k.toLowerCase().includes(searchTerm.toLowerCase()))
            .map(k => renderSingleControl(activeSection, k, config[activeSection][k]))}
        </div>
      </div>
    </div>
  );
};

export default ConfigForm;
