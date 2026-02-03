
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ConfigVersion, ConfigData, HUDModule } from './types';
import { VERSIONS, DEFAULT_CONFIGS, HUD_SIZES } from './constants';
import ConfigForm from './components/ConfigForm';
import HUDCanvas from './components/HUDCanvas';
import RawEditor from './components/RawEditor';

const App: React.FC = () => {
  const [version, setVersion] = useState<ConfigVersion>('v6');
  const [config, setConfig] = useState<ConfigData>(DEFAULT_CONFIGS['v6']);
  const [activeTab, setActiveTab] = useState<'visual' | 'raw'>('visual');
  const [activeSection, setActiveSection] = useState<string>('mod_menu_config@gc.pnl');
  const [mobileView, setMobileView] = useState<'config' | 'preview'>('config');
  
  const [history, setHistory] = useState<ConfigData[]>([]);
  const [redoStack, setRedoStack] = useState<ConfigData[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const defaultConfig = DEFAULT_CONFIGS[version];
    setConfig(defaultConfig);
    setHistory([]);
    setRedoStack([]);
    const sections = Object.keys(defaultConfig).filter(k => typeof defaultConfig[k] === 'object' && k !== 'namespace');
    if (sections.length > 0) {
      setActiveSection(sections[0]);
    }
  }, [version]);

  const updateConfig = useCallback((path: string[], value: any, skipHistory = false) => {
    setConfig(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      let curr = next;
      for (let i = 0; i < path.length - 1; i++) {
        if (!curr[path[i]]) curr[path[i]] = {};
        curr = curr[path[i]];
      }
      curr[path[path.length - 1]] = value;

      if (!skipHistory) {
        setHistory(h => [...h.slice(-19), prev]);
        setRedoStack([]);
      }
      return next;
    });
  }, []);

  const handleUndo = useCallback(() => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setRedoStack(r => [...r, config]);
    setHistory(h => h.slice(0, -1));
    setConfig(prev);
  }, [history, config]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setHistory(h => [...h, config]);
    setRedoStack(r => r.slice(0, -1));
    setConfig(next);
  }, [redoStack, config]);

  const handleResetSection = useCallback(() => {
    const defaultSec = DEFAULT_CONFIGS[version][activeSection];
    if (defaultSec) {
      updateConfig([activeSection], JSON.parse(JSON.stringify(defaultSec)));
    }
  }, [version, activeSection, updateConfig]);

  const handleExport = useCallback(() => {
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `config.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [config, version]);

  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        setHistory(h => [...h.slice(-19), config]);
        setRedoStack([]);
        setConfig(json);
      } catch (err) {
        alert("Invalid JSON file provided.");
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }, [config]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); handleUndo(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); handleRedo(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  const hudModules = useMemo(() => {
    const modules: HUDModule[] = [];
    const modMenu = config["mod_menu_config@gc.pnl"];
    if (!modMenu) return modules;
    Object.keys(modMenu).forEach(key => {
      if (key.startsWith('$') && typeof modMenu[key] === 'boolean' && !key.includes('_')) {
        const baseKey = key.substring(1);
        const anchorKey = `$${baseKey}_anchor|default`;
        const offsetKey = `$${baseKey}_offset|default`;
        if (modMenu[anchorKey] !== undefined && modMenu[offsetKey] !== undefined) {
          const size = HUD_SIZES[baseKey] || { w: 64, h: 32, icon: 'fa-cube' };
          modules.push({
            id: baseKey,
            toggleKey: key,
            anchorKey,
            offsetKey,
            width: size.w,
            height: size.h,
            icon: size.icon
          });
        }
      }
    });
    return modules;
  }, [config]);

  const availableSections = useMemo(() => {
    return Object.keys(config).filter(k => typeof config[k] === 'object' && k !== 'namespace');
  }, [config]);

  const getSectionLabel = (sec: string) => {
    if (sec.includes('mod_menu')) return 'Mod Menu';
    if (sec.includes('start_screen')) return 'Start Screen';
    if (sec.includes('pause_menu')) return 'Pause Menu';
    if (sec.includes('container')) return 'Container';
    return sec.split('_')[0];
  };

  return (
    <div className="flex flex-col min-h-screen text-zinc-100">
      <header className="sticky top-0 z-[1000] bg-[#282b30]/95 backdrop-blur-md border-b border-white/5 shadow-2xl">
        <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="https://glacierclient.xyz/assets/logo.png" className="w-8 h-8 md:w-10 md:h-10 rounded-full border border-white/10" alt="Logo" />
            <h1 className="text-lg md:text-xl font-extrabold tracking-tight bg-gradient-to-r from-[#7289da] to-[#9ba9ff] bg-clip-text text-transparent">
              Glacier <span className="hidden sm:inline">Editor</span>
            </h1>
          </div>
          
          <div className="flex items-center gap-2 md:gap-4">
            <div className="flex gap-1 bg-[#1e2124] p-1 rounded-lg border border-white/5">
              <button onClick={handleUndo} disabled={history.length === 0} className="p-2 hover:bg-white/5 rounded disabled:opacity-20 transition-colors" title="Undo (Ctrl+Z)">
                <i className="fas fa-undo text-xs"></i>
              </button>
              <button onClick={handleRedo} disabled={redoStack.length === 0} className="p-2 hover:bg-white/5 rounded disabled:opacity-20 transition-colors" title="Redo (Ctrl+Y)">
                <i className="fas fa-redo text-xs"></i>
              </button>
            </div>
            <a href="https://dsc.gg/glacierclientmcbe" target="_blank" className="hidden sm:flex px-4 py-2 text-sm font-semibold bg-[#424549] hover:bg-[#4e5d94] rounded-full transition-all border border-white/5">
              <i className="fab fa-discord mr-2"></i> Discord
            </a>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-[1400px] w-full mx-auto px-4 md:px-6 py-6 md:py-10">
        {/* Mobile View Toggle - Only visible below MD breakpoint (768px) */}
        <div className="md:hidden flex mb-6 p-1 bg-[#1e2124] rounded-xl border border-white/5">
          <button 
            onClick={() => setMobileView('config')}
            className={`flex-1 py-3 text-xs font-bold rounded-lg transition-all ${mobileView === 'config' ? 'bg-[#7289da] text-white shadow-lg' : 'text-zinc-500'}`}
          >
            <i className="fas fa-cog mr-2"></i> Config
          </button>
          <button 
            onClick={() => setMobileView('preview')}
            className={`flex-1 py-3 text-xs font-bold rounded-lg transition-all ${mobileView === 'preview' ? 'bg-[#7289da] text-white shadow-lg' : 'text-zinc-500'}`}
          >
            <i className="fas fa-eye mr-2"></i> Preview
          </button>
        </div>

        <div className="flex gap-2 md:gap-3 mb-8 bg-[#424549]/40 p-3 md:p-4 rounded-2xl backdrop-blur-md border border-white/5 overflow-x-auto no-scrollbar">
          {VERSIONS.map(v => (
            <button
              key={v}
              onClick={() => setVersion(v)}
              className={`flex items-center gap-2 px-5 md:px-6 py-3 rounded-full font-bold text-xs md:text-sm transition-all whitespace-nowrap ${version === v ? 'bg-[#7289da] text-white shadow-xl scale-105' : 'bg-[#1e2124]/70 text-zinc-500 hover:text-white'}`}
            >
              <i className="fas fa-code-branch"></i> {v.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Responsive Grid: Stacks on mobile, Side-by-side on Tablets (md: 768px+) and Desktops */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 items-start">
          
          {/* Config Section */}
          <section className={`${mobileView === 'preview' ? 'hidden md:flex' : 'flex'} flex-col bg-[#424549]/40 rounded-3xl p-5 md:p-8 shadow-2xl backdrop-blur-xl border border-white/5 h-[calc(100vh-320px)] md:h-[800px]`}>
            <div className="flex flex-col gap-4 border-b border-white/10 pb-6 mb-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg md:text-xl font-black uppercase tracking-tight text-zinc-200">Configuration</h2>
                <button onClick={handleResetSection} className="text-[10px] font-black uppercase tracking-widest px-3 py-2 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl hover:bg-red-500/20 transition-all">
                  Reset
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {availableSections.map(sec => (
                  <button
                    key={sec}
                    onClick={() => setActiveSection(sec)}
                    className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeSection === sec ? 'bg-[#7289da] text-white' : 'bg-[#1e2124] text-zinc-500 hover:text-zinc-300'}`}
                  >
                    {getSectionLabel(sec)}
                  </button>
                ))}
              </div>
            </div>
            
            <ConfigForm config={config} activeSection={activeSection} onUpdate={updateConfig} />
            
            <div className="flex gap-3 pt-6 mt-auto border-t border-white/10">
              <button onClick={handleExport} className="flex-1 bg-[#7289da] hover:bg-[#5b6eae] text-white font-black uppercase tracking-widest py-4 rounded-2xl transition-all shadow-lg text-xs">
                Export JSON
              </button>
              <button onClick={handleImportClick} className="px-5 py-4 rounded-2xl bg-[#1e2124] border border-white/10 text-zinc-400 hover:text-white transition-all">
                <i className="fas fa-upload"></i>
              </button>
              <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleFileChange} />
            </div>
          </section>

          {/* Preview/Visual Section */}
          <section className={`${mobileView === 'config' ? 'hidden md:flex' : 'flex'} flex-col bg-[#424549]/40 rounded-3xl p-5 md:p-8 shadow-2xl backdrop-blur-xl border border-white/5 h-[calc(100vh-320px)] md:h-[800px]`}>
            <div className="flex items-center justify-between border-b border-white/10 pb-6 mb-6">
              <div className="flex gap-6">
                <button onClick={() => setActiveTab('visual')} className={`text-xs font-black uppercase tracking-widest pb-2 transition-all ${activeTab === 'visual' ? 'text-[#7289da] border-b-2 border-[#7289da]' : 'text-zinc-500 hover:text-zinc-300'}`}>Visual</button>
                <button onClick={() => setActiveTab('raw')} className={`text-xs font-black uppercase tracking-widest pb-2 transition-all ${activeTab === 'raw' ? 'text-[#7289da] border-b-2 border-[#7289da]' : 'text-zinc-500 hover:text-zinc-300'}`}>Code</button>
              </div>
            </div>

            <div className="flex-1 overflow-hidden">
              {activeTab === 'visual' ? (
                <HUDCanvas config={config} modules={hudModules} onUpdate={updateConfig} />
              ) : (
                <RawEditor config={config} onUpdate={(newConfig) => setConfig(newConfig)} />
              )}
            </div>

            {activeTab === 'raw' && (
              <button onClick={() => { navigator.clipboard.writeText(JSON.stringify(config, null, 2)); alert("Copied!"); }} className="mt-4 w-full bg-[#1e2124] text-white font-black py-4 rounded-2xl uppercase tracking-widest text-xs hover:bg-black transition-all">
                Copy to Clipboard
              </button>
            )}
          </section>
        </div>
      </main>
    </div>
  );
};

export default App;
