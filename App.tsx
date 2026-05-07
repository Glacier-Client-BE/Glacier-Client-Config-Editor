import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ConfigVersion, ConfigData, HUDModule } from './types';
import { VERSIONS, DEFAULT_CONFIGS, HUD_SIZES } from './constants';
import ConfigForm from './components/ConfigForm';
import HUDCanvas from './components/HUDCanvas';
import RawEditor from './components/RawEditor';
import TutorialModal from './components/TutorialModal';

const HISTORY_LIMIT = 30;

const cloneConfig = (cfg: ConfigData): ConfigData =>
  typeof structuredClone === 'function' ? structuredClone(cfg) : JSON.parse(JSON.stringify(cfg));

const SECTION_LABELS: Array<[string, string]> = [
  ['mod_menu', 'Mod Menu'],
  ['start_screen', 'Start Screen'],
  ['pause_menu', 'Pause Menu'],
  ['container', 'Container'],
];

const getSectionLabel = (sec: string) => {
  for (const [k, v] of SECTION_LABELS) if (sec.includes(k)) return v;
  return sec.split('_')[0];
};

const App: React.FC = () => {
  const [version, setVersion] = useState<ConfigVersion>('v6');
  const [config, setConfig] = useState<ConfigData>(() => cloneConfig(DEFAULT_CONFIGS['v6']));
  const [activeTab, setActiveTab] = useState<'visual' | 'raw'>('visual');
  const [activeSection, setActiveSection] = useState<string>('mod_menu_config@gc.pnl');
  const [mobileView, setMobileView] = useState<'config' | 'preview'>('config');
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const [history, setHistory] = useState<ConfigData[]>([]);
  const [redoStack, setRedoStack] = useState<ConfigData[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toastTimer = useRef<number | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2200);
  }, []);

  useEffect(() => () => { if (toastTimer.current) window.clearTimeout(toastTimer.current); }, []);

  useEffect(() => {
    const defaultConfig = cloneConfig(DEFAULT_CONFIGS[version]);
    setConfig(defaultConfig);
    setHistory([]);
    setRedoStack([]);
    const sections = Object.keys(defaultConfig).filter(k => typeof defaultConfig[k] === 'object' && k !== 'namespace');
    if (sections.length > 0) setActiveSection(sections[0]);
  }, [version]);

  const updateConfig = useCallback((path: string[], value: any, skipHistory = false) => {
    setConfig(prev => {
      const next = cloneConfig(prev);
      let curr: any = next;
      for (let i = 0; i < path.length - 1; i++) {
        if (curr[path[i]] == null) curr[path[i]] = {};
        curr = curr[path[i]];
      }
      curr[path[path.length - 1]] = value;
      if (!skipHistory) {
        setHistory(h => (h.length >= HISTORY_LIMIT ? [...h.slice(1), prev] : [...h, prev]));
        setRedoStack([]);
      }
      return next;
    });
  }, []);

  const handleUndo = useCallback(() => {
    setHistory(h => {
      if (h.length === 0) return h;
      const prev = h[h.length - 1];
      setRedoStack(r => [...r, config]);
      setConfig(prev);
      return h.slice(0, -1);
    });
  }, [config]);

  const handleRedo = useCallback(() => {
    setRedoStack(r => {
      if (r.length === 0) return r;
      const next = r[r.length - 1];
      setHistory(h => [...h, config]);
      setConfig(next);
      return r.slice(0, -1);
    });
  }, [config]);

  const handleResetSection = useCallback(() => {
    const defaultSec = DEFAULT_CONFIGS[version][activeSection];
    if (defaultSec) {
      updateConfig([activeSection], cloneConfig(defaultSec));
      showToast('Section reset to defaults');
    }
  }, [version, activeSection, updateConfig, showToast]);

  const handleExport = useCallback(() => {
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'config.json';
    a.click();
    URL.revokeObjectURL(url);
    showToast('config.json exported');
  }, [config, showToast]);

  const handleImportClick = useCallback(() => fileInputRef.current?.click(), []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        setHistory(h => (h.length >= HISTORY_LIMIT ? [...h.slice(1), config] : [...h, config]));
        setRedoStack([]);
        setConfig(json);
        showToast('Config imported');
      } catch {
        showToast('Invalid JSON file');
      }
    };
    reader.readAsText(file);
  }, [config, showToast]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(config, null, 2));
      showToast('Copied to clipboard');
    } catch {
      showToast('Copy failed');
    }
  }, [config, showToast]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if (isInput) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); handleUndo(); }
      else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) { e.preventDefault(); handleRedo(); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); handleExport(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo, handleExport]);

  const hudModules = useMemo<HUDModule[]>(() => {
    const modules: HUDModule[] = [];
    const modMenu = config['mod_menu_config@gc.pnl'];
    if (!modMenu) return modules;
    for (const key of Object.keys(modMenu)) {
      if (!key.startsWith('$') || typeof modMenu[key] !== 'boolean' || key.includes('_')) continue;
      const baseKey = key.substring(1);
      const anchorKey = `$${baseKey}_anchor|default`;
      const offsetKey = `$${baseKey}_offset|default`;
      if (modMenu[anchorKey] === undefined || modMenu[offsetKey] === undefined) continue;
      const size = HUD_SIZES[baseKey] || { w: 64, h: 32, icon: 'fa-cube' };
      modules.push({ id: baseKey, toggleKey: key, anchorKey, offsetKey, width: size.w, height: size.h, icon: size.icon });
    }
    return modules;
  }, [config]);

  const availableSections = useMemo(
    () => Object.keys(config).filter(k => typeof config[k] === 'object' && k !== 'namespace'),
    [config]
  );

  return (
    <div className="flex flex-col min-h-screen text-zinc-100">
      <header className="sticky top-0 z-[1000] bg-glacier-darker/95 backdrop-blur-md border-b border-white/5 shadow-lg">
        <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-3 md:py-4 flex items-center justify-between gap-3">
          <a href="https://glacierclient.xyz/" target="_blank" rel="noopener" className="flex items-center gap-3 group">
            <img
              src="https://glacierclient.xyz/assets/logo.png"
              alt="Glacier"
              loading="eager"
              decoding="async"
              className="w-9 h-9 md:w-10 md:h-10 rounded-full border-2 border-transparent shadow-[0_0_10px_rgba(114,137,218,.3)] transition-all group-hover:border-blurple group-hover:rotate-[10deg] group-hover:scale-110"
            />
            <div className="flex flex-col leading-none">
              <h1 className="text-lg md:text-xl font-extrabold tracking-tight gradient-text-blurple">
                Glacier <span className="hidden sm:inline">Editor</span>
              </h1>
              <span className="hidden sm:block text-[10px] text-glacier-muted font-medium mt-1">Config visualizer</span>
            </div>
          </a>

          <div className="flex items-center gap-2">
            <div className="flex gap-1 bg-glacier-black/70 p-1 rounded-full border border-white/5">
              <button
                onClick={handleUndo}
                disabled={history.length === 0}
                className="w-9 h-9 flex items-center justify-center hover:bg-blurple/20 hover:text-white rounded-full text-glacier-muted disabled:opacity-25 disabled:hover:bg-transparent transition-all focus-ring"
                title="Undo (Ctrl+Z)"
                aria-label="Undo"
              >
                <i className="fas fa-undo text-xs"></i>
              </button>
              <button
                onClick={handleRedo}
                disabled={redoStack.length === 0}
                className="w-9 h-9 flex items-center justify-center hover:bg-blurple/20 hover:text-white rounded-full text-glacier-muted disabled:opacity-25 disabled:hover:bg-transparent transition-all focus-ring"
                title="Redo (Ctrl+Y)"
                aria-label="Redo"
              >
                <i className="fas fa-redo text-xs"></i>
              </button>
            </div>

            <button
              onClick={() => setTutorialOpen(true)}
              className="hidden sm:flex w-9 h-9 items-center justify-center rounded-full bg-glacier-black/70 hover:bg-blurple/25 hover:scale-105 border border-white/5 text-glacier-muted hover:text-white transition-all focus-ring"
              title="Tutorial / Help"
              aria-label="Open tutorial"
            >
              <i className="fas fa-book text-xs"></i>
            </button>

            <a
              href="https://dsc.gg/glacierclientmcbe"
              target="_blank"
              rel="noopener"
              className="hidden md:inline-flex btn-shine items-center gap-2 px-5 py-2.5 text-sm font-semibold bg-gradient-to-r from-blurple to-blurple-dark hover:-translate-y-0.5 rounded-full shadow-[0_4px_15px_rgba(114,137,218,.35)] hover:shadow-[0_8px_24px_rgba(114,137,218,.55)] transition-all"
            >
              <i className="fab fa-discord"></i> Discord
            </a>

            <button
              onClick={() => setTutorialOpen(true)}
              className="sm:hidden w-9 h-9 rounded-full bg-glacier-black/70 border border-white/5 text-glacier-muted active:scale-95 transition-all"
              aria-label="Tutorial"
            >
              <i className="fas fa-book text-xs"></i>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-[1400px] w-full mx-auto px-4 md:px-6 py-5 md:py-10 mobile-safe-bottom">
        <div className="md:hidden flex mb-5 p-1 bg-glacier-black/70 rounded-full border border-white/5 shadow-inner">
          <button
            onClick={() => setMobileView('config')}
            className={`flex-1 py-2.5 text-xs font-bold rounded-full transition-all ${mobileView === 'config' ? 'bg-blurple text-white shadow-[0_4px_15px_rgba(114,137,218,.4)]' : 'text-glacier-muted'}`}
          >
            <i className="fas fa-cog mr-2"></i> Config
          </button>
          <button
            onClick={() => setMobileView('preview')}
            className={`flex-1 py-2.5 text-xs font-bold rounded-full transition-all ${mobileView === 'preview' ? 'bg-blurple text-white shadow-[0_4px_15px_rgba(114,137,218,.4)]' : 'text-glacier-muted'}`}
          >
            <i className="fas fa-eye mr-2"></i> Preview
          </button>
        </div>

        <div className="flex gap-2 mb-6 md:mb-8 bg-glacier-darker/50 p-2 md:p-3 rounded-full backdrop-blur-md border border-white/5 overflow-x-auto no-scrollbar">
          {VERSIONS.map(v => (
            <button
              key={v}
              onClick={() => setVersion(v)}
              className={`flex items-center gap-2 px-5 md:px-6 py-2.5 rounded-full font-bold text-xs md:text-sm transition-all whitespace-nowrap ${version === v ? 'bg-blurple text-white shadow-[0_4px_15px_rgba(114,137,218,.4)] scale-[1.02]' : 'bg-glacier-black/60 text-glacier-muted hover:text-white hover:bg-blurple/20'}`}
            >
              <i className="fas fa-code-branch text-[10px]"></i> {v.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6 items-start">
          <section className={`${mobileView === 'preview' ? 'hidden md:flex' : 'flex'} card-base flex-col rounded-2xl p-4 md:p-6 lg:p-7 h-[calc(100dvh-260px)] md:h-[78vh] md:max-h-[820px] anim-slide-up`}>
            <div className="flex flex-col gap-4 border-b border-white/10 pb-4 md:pb-5 mb-4 md:mb-5">
              <div className="flex items-center justify-between">
                <h2 className="text-base md:text-lg font-extrabold uppercase tracking-tight text-zinc-100">
                  <i className="fas fa-sliders-h text-blurple mr-2 text-sm"></i>Configuration
                </h2>
                <button
                  onClick={handleResetSection}
                  className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 bg-glacier-red/10 text-glacier-red border border-glacier-red/20 rounded-full hover:bg-glacier-red/20 transition-all"
                  title="Reset current section"
                >
                  <i className="fas fa-rotate-left mr-1.5 text-[9px]"></i>Reset
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {availableSections.map(sec => (
                  <button
                    key={sec}
                    onClick={() => setActiveSection(sec)}
                    className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${activeSection === sec ? 'bg-blurple text-white shadow-[0_4px_12px_rgba(114,137,218,.3)]' : 'bg-glacier-black/70 text-glacier-muted hover:text-white hover:bg-blurple/20'}`}
                  >
                    {getSectionLabel(sec)}
                  </button>
                ))}
              </div>
            </div>

            <ConfigForm config={config} activeSection={activeSection} onUpdate={updateConfig} />

            <div className="flex gap-2.5 pt-4 mt-4 border-t border-white/10">
              <button
                onClick={handleExport}
                className="btn-shine flex-1 bg-gradient-to-r from-blurple to-blurple-dark hover:-translate-y-0.5 text-white font-black uppercase tracking-widest py-3 rounded-full transition-all shadow-[0_4px_15px_rgba(114,137,218,.35)] hover:shadow-[0_8px_24px_rgba(114,137,218,.55)] text-xs"
              >
                <i className="fas fa-download mr-2"></i>Export JSON
              </button>
              <button
                onClick={handleImportClick}
                className="px-4 py-3 rounded-full bg-glacier-black/70 border border-white/10 text-glacier-muted hover:text-white hover:border-blurple/40 transition-all"
                title="Import JSON"
                aria-label="Import JSON"
              >
                <i className="fas fa-upload"></i>
              </button>
              <input type="file" ref={fileInputRef} className="hidden" accept=".json,application/json" onChange={handleFileChange} />
            </div>
          </section>

          <section className={`${mobileView === 'config' ? 'hidden md:flex' : 'flex'} card-base flex-col rounded-2xl p-4 md:p-6 lg:p-7 h-[calc(100dvh-260px)] md:h-[78vh] md:max-h-[820px] anim-slide-up`}>
            <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4 md:mb-5">
              <div className="flex gap-5">
                <button
                  onClick={() => setActiveTab('visual')}
                  className={`text-xs font-black uppercase tracking-widest pb-2 transition-all relative ${activeTab === 'visual' ? 'text-blurple' : 'text-glacier-muted hover:text-white'}`}
                >
                  <i className="fas fa-eye mr-1.5"></i>Visual
                  {activeTab === 'visual' && <span className="absolute -bottom-px left-0 right-0 h-0.5 bg-gradient-to-r from-blurple to-glacier-green rounded-full"></span>}
                </button>
                <button
                  onClick={() => setActiveTab('raw')}
                  className={`text-xs font-black uppercase tracking-widest pb-2 transition-all relative ${activeTab === 'raw' ? 'text-blurple' : 'text-glacier-muted hover:text-white'}`}
                >
                  <i className="fas fa-code mr-1.5"></i>Code
                  {activeTab === 'raw' && <span className="absolute -bottom-px left-0 right-0 h-0.5 bg-gradient-to-r from-blurple to-glacier-green rounded-full"></span>}
                </button>
              </div>
              {activeTab === 'raw' && (
                <button
                  onClick={handleCopy}
                  className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 bg-blurple/15 text-blurple border border-blurple/25 rounded-full hover:bg-blurple/25 transition-all"
                >
                  <i className="fas fa-copy mr-1.5 text-[9px]"></i>Copy
                </button>
              )}
            </div>

            <div className="flex-1 overflow-hidden min-h-0">
              {activeTab === 'visual' ? (
                <HUDCanvas config={config} modules={hudModules} onUpdate={updateConfig} />
              ) : (
                <RawEditor config={config} onUpdate={setConfig} />
              )}
            </div>
          </section>
        </div>

        <footer className="mt-8 md:mt-10 text-center text-[10px] text-glacier-muted/70 font-medium tracking-wide">
          Glacier Editor · made for the Glacier Client community ·{' '}
          <button onClick={() => setTutorialOpen(true)} className="text-blurple hover:underline">Tutorial</button>
        </footer>
      </main>

      <TutorialModal open={tutorialOpen} onClose={() => setTutorialOpen(false)} />

      <div
        aria-live="polite"
        className={`fixed bottom-5 left-1/2 -translate-x-1/2 z-[1100] px-4 py-2.5 rounded-full bg-glacier-black/95 border border-blurple/30 shadow-[0_8px_24px_rgba(0,0,0,.5)] text-xs font-bold text-white backdrop-blur-md transition-all duration-300 ${toast ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'}`}
      >
        <i className="fas fa-check-circle text-glacier-green mr-2"></i>{toast}
      </div>
    </div>
  );
};

export default App;
