import React, { useEffect, useRef, useState } from 'react';

interface TutorialModalProps {
  open: boolean;
  onClose: () => void;
}

type Tab = 'editors' | 'locate' | 'customize' | 'video';

const TABS: Array<{ id: Tab; label: string; icon: string }> = [
  { id: 'editors', label: 'Editors', icon: 'fa-pen-to-square' },
  { id: 'locate', label: 'Locate File', icon: 'fa-folder-open' },
  { id: 'customize', label: 'Customize', icon: 'fa-sliders' },
  { id: 'video', label: 'Videos', icon: 'fa-circle-play' },
];

const TutorialModal: React.FC<TutorialModalProps> = ({ open, onClose }) => {
  const [tab, setTab] = useState<Tab>('editors');
  const [copied, setCopied] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      window.setTimeout(() => setCopied(c => (c === key ? null : c)), 1400);
    } catch { /* ignore */ }
  };

  if (!open) return null;

  const PathBlock: React.FC<{ value: string; copyKey: string; label?: string }> = ({ value, copyKey, label }) => (
    <div className="group relative bg-glacier-black/80 border border-white/5 rounded-xl px-3 py-2.5 flex items-center gap-2">
      {label && <span className="text-[9px] font-black uppercase tracking-widest text-glacier-muted shrink-0">{label}</span>}
      <code className="flex-1 text-[11px] md:text-xs font-mono text-zinc-200 break-all leading-relaxed">{value}</code>
      <button
        onClick={() => copy(value, copyKey)}
        className="shrink-0 px-2 py-1 rounded-md bg-blurple/15 hover:bg-blurple/30 text-blurple text-[10px] font-bold transition-all"
        aria-label="Copy path"
      >
        <i className={`fas ${copied === copyKey ? 'fa-check' : 'fa-copy'} mr-1`}></i>
        {copied === copyKey ? 'Copied' : 'Copy'}
      </button>
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-[2000] bg-black/70 backdrop-blur-md flex items-end md:items-center justify-center p-0 md:p-6 anim-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Configuration Tutorial"
    >
      <div
        ref={dialogRef}
        onClick={e => e.stopPropagation()}
        className="card-base w-full max-w-3xl rounded-t-3xl md:rounded-2xl border border-white/10 max-h-[90dvh] flex flex-col overflow-hidden anim-slide-up"
      >
        <div className="flex items-center justify-between px-5 md:px-6 py-4 border-b border-white/10 bg-gradient-to-r from-blurple/10 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blurple/20 border border-blurple/30 flex items-center justify-center">
              <i className="fas fa-snowflake text-blurple"></i>
            </div>
            <div>
              <h2 className="text-base md:text-lg font-extrabold gradient-text-blurple">Configuration Guide</h2>
              <p className="text-[10px] md:text-xs text-glacier-muted">Locate · edit · customize</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-glacier-black/70 hover:bg-glacier-red/20 hover:text-glacier-red border border-white/10 text-glacier-muted transition-all"
            aria-label="Close tutorial"
          >
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="flex gap-1 px-3 md:px-5 pt-3 border-b border-white/5 overflow-x-auto no-scrollbar">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3.5 md:px-4 py-2 rounded-t-lg text-[11px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${tab === t.id ? 'bg-blurple/15 text-blurple border-b-2 border-blurple' : 'text-glacier-muted hover:text-white border-b-2 border-transparent'}`}
            >
              <i className={`fas ${t.icon} mr-1.5 text-[10px]`}></i>{t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-5 md:p-6 space-y-4">
          {tab === 'editors' && (
            <div className="space-y-3 anim-fade-in">
              <h3 className="text-sm font-extrabold text-white flex items-center gap-2"><i className="fas fa-screwdriver-wrench text-blurple"></i> Recommended Editors</h3>
              <p className="text-xs text-glacier-muted leading-relaxed">Use a proper text editor that handles JSON safely without corrupting the file's encoding.</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2">
                {[
                  { os: 'Android', icon: 'fa-android', apps: 'MT Manager · QuickEdit', color: 'from-glacier-green/20 to-glacier-green/5', accent: 'text-glacier-green' },
                  { os: 'iOS', icon: 'fa-apple', apps: 'Documents by Readdle', color: 'from-blurple/20 to-blurple/5', accent: 'text-blurple' },
                  { os: 'PC', icon: 'fa-windows', apps: 'VS Code · Notepad++', color: 'from-glacier-pink/20 to-glacier-pink/5', accent: 'text-glacier-pink' },
                ].map(c => (
                  <div key={c.os} className={`bg-gradient-to-br ${c.color} border border-white/5 rounded-xl p-4 hover:border-white/15 transition-all`}>
                    <i className={`fab ${c.icon} text-2xl ${c.accent}`}></i>
                    <div className="text-[10px] uppercase tracking-widest text-glacier-muted mt-3 font-black">{c.os}</div>
                    <div className="text-xs font-semibold text-white mt-1">{c.apps}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'locate' && (
            <div className="space-y-5 anim-fade-in">
              <div>
                <h3 className="text-sm font-extrabold text-white flex items-center gap-2"><i className="fab fa-android text-blurple"></i> Android</h3>
                <ol className="mt-2 space-y-2 text-xs text-glacier-muted list-decimal pl-4 marker:text-blurple marker:font-bold">
                  <li>Open your device's <span className="text-white font-semibold">Files</span> app.</li>
                  <li>Navigate to:</li>
                </ol>
                <div className="mt-2">
                  <PathBlock copyKey="m1" value="Android/data/com.mojang.minecraftpe/files/games/com.mojang/resource_packs/" />
                </div>
                <p className="text-xs text-glacier-muted mt-2">Open the <span className="text-white font-semibold">/Glacier</span> folder and locate <code className="text-blurple font-mono">config.json</code>.</p>
              </div>

              <div className="border-t border-white/5 pt-5">
                <h3 className="text-sm font-extrabold text-white flex items-center gap-2"><i className="fab fa-apple text-blurple"></i> iOS / iPadOS</h3>
                <ol className="mt-2 space-y-2 text-xs text-glacier-muted list-decimal pl-4 marker:text-blurple marker:font-bold">
                  <li>Open the <span className="text-white font-semibold">Files</span> app &rarr; <span className="text-white font-semibold">On My iPhone</span> (or <span className="text-white font-semibold">iPad</span>).</li>
                  <li>Navigate to:</li>
                </ol>
                <div className="mt-2">
                  <PathBlock copyKey="i1" label="iOS" value="On My iPhone/Minecraft/games/com.mojang/resource_packs/" />
                </div>
                <p className="text-xs text-glacier-muted mt-2">Open the <span className="text-white font-semibold">/Glacier</span> folder and locate <code className="text-blurple font-mono">config.json</code>. If <span className="text-white font-semibold">Minecraft</span> doesn't appear in the Files app, open Minecraft once after installing it from the App Store so the folder is created.</p>
              </div>

              <div className="border-t border-white/5 pt-5">
                <h3 className="text-sm font-extrabold text-white flex items-center gap-2"><i className="fab fa-windows text-blurple"></i> Windows (PC)</h3>
                <ol className="mt-2 space-y-2 text-xs text-glacier-muted list-decimal pl-4 marker:text-blurple marker:font-bold">
                  <li>Press <kbd className="px-1.5 py-0.5 bg-glacier-black border border-white/10 rounded text-[10px] font-mono text-white">Win + R</kbd>, then paste:</li>
                </ol>
                <div className="mt-2">
                  <PathBlock copyKey="w1" label="MS Store" value="%userprofile%\AppData\Local\Packages\Microsoft.MinecraftUWP_8wekyb3d8bbwe\LocalState\games\com.mojang\resource_packs" />
                </div>
                <div className="mt-2">
                  <PathBlock copyKey="w2" label="GDK" value="%userprofile%\AppData\Roaming\Minecraft Bedrock\Users\Shared\games\com.mojang\resource_packs" />
                </div>
                <p className="text-xs text-glacier-muted mt-3">Open the <span className="text-white font-semibold">/Glacier</span> folder and locate <code className="text-blurple font-mono">config.json</code>.</p>
              </div>
            </div>
          )}

          {tab === 'customize' && (
            <div className="space-y-4 anim-fade-in">
              <h3 className="text-sm font-extrabold text-white flex items-center gap-2"><i className="fas fa-wand-magic-sparkles text-blurple"></i> Customizing Your Settings</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-glacier-black/60 border border-white/5 rounded-xl p-4">
                  <div className="text-[10px] uppercase tracking-widest text-blurple font-black">Toggles</div>
                  <div className="mt-2 flex gap-2">
                    <code className="text-xs font-mono px-2 py-1 rounded-md bg-glacier-green/15 text-glacier-green border border-glacier-green/25">true</code>
                    <code className="text-xs font-mono px-2 py-1 rounded-md bg-glacier-red/15 text-glacier-red border border-glacier-red/25">false</code>
                  </div>
                  <p className="text-[11px] text-glacier-muted mt-2 leading-relaxed">Enable/disable a module.</p>
                </div>
                <div className="bg-glacier-black/60 border border-white/5 rounded-xl p-4">
                  <div className="text-[10px] uppercase tracking-widest text-blurple font-black">Opacity</div>
                  <code className="text-xs font-mono mt-2 inline-block px-2 py-1 rounded-md bg-blurple/15 text-blurple border border-blurple/25">0.0 → 1.0</code>
                  <p className="text-[11px] text-glacier-muted mt-2 leading-relaxed">Transparency of the HUD element.</p>
                </div>
                <div className="bg-glacier-black/60 border border-white/5 rounded-xl p-4">
                  <div className="text-[10px] uppercase tracking-widest text-blurple font-black">Offset (X, Y)</div>
                  <code className="text-xs font-mono mt-2 inline-block px-2 py-1 rounded-md bg-blurple/15 text-blurple border border-blurple/25">[x, y]</code>
                  <p className="text-[11px] text-glacier-muted mt-2 leading-relaxed">Move HUD element by pixels.</p>
                </div>
              </div>

              <div className="bg-gradient-to-br from-blurple/15 to-transparent border border-blurple/20 rounded-xl p-4 mt-4">
                <div className="flex items-start gap-3">
                  <i className="fas fa-lightbulb text-blurple text-lg mt-0.5"></i>
                  <div>
                    <h4 className="text-xs font-extrabold text-white">Tip</h4>
                    <p className="text-[11px] text-glacier-muted mt-1 leading-relaxed">
                      You can do all of this <span className="text-white font-semibold">visually</span> right here — drag HUD elements
                      on the preview canvas, toggle modules, and the JSON updates live. When you're done, click
                      <span className="text-blurple font-semibold"> Export JSON</span>.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === 'video' && (
            <div className="space-y-3 anim-fade-in">
              <h3 className="text-sm font-extrabold text-white flex items-center gap-2"><i className="fas fa-circle-play text-blurple"></i> Video Tutorials</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <a
                  href="https://youtu.be/RrTHx6V-zp4"
                  target="_blank"
                  rel="noopener"
                  className="group relative overflow-hidden bg-gradient-to-br from-glacier-red/20 to-glacier-red/5 border border-white/5 hover:border-glacier-red/50 rounded-xl p-5 transition-all"
                >
                  <i className="fab fa-youtube text-3xl text-glacier-red"></i>
                  <div className="text-xs uppercase tracking-widest text-glacier-muted mt-3 font-black">Android · ChromeOS</div>
                  <div className="text-sm font-bold text-white mt-1">Watch Tutorial</div>
                  <i className="fas fa-arrow-up-right-from-square absolute top-4 right-4 text-glacier-muted group-hover:text-white transition-colors"></i>
                </a>
                <a
                  href="https://youtu.be/oaQCtVdNUXg"
                  target="_blank"
                  rel="noopener"
                  className="group relative overflow-hidden bg-gradient-to-br from-blurple/20 to-blurple/5 border border-white/5 hover:border-blurple/50 rounded-xl p-5 transition-all"
                >
                  <i className="fab fa-youtube text-3xl text-glacier-red"></i>
                  <div className="text-xs uppercase tracking-widest text-glacier-muted mt-3 font-black">iPadOS · iOS</div>
                  <div className="text-sm font-bold text-white mt-1">Watch Tutorial</div>
                  <i className="fas fa-arrow-up-right-from-square absolute top-4 right-4 text-glacier-muted group-hover:text-white transition-colors"></i>
                </a>
              </div>
              <div className="mt-3 text-center">
                <a
                  href="https://config.glacierclient.xyz/"
                  target="_blank"
                  rel="noopener"
                  className="inline-flex items-center gap-2 text-[11px] font-bold text-blurple hover:text-blurple-light"
                >
                  <i className="fas fa-globe"></i> config.glacierclient.xyz
                </a>
              </div>
            </div>
          )}
        </div>

        <div className="px-5 md:px-6 py-3 border-t border-white/10 flex items-center justify-between bg-glacier-black/40 mobile-safe-bottom">
          <span className="text-[10px] text-glacier-muted">
            <kbd className="px-1.5 py-0.5 bg-glacier-black border border-white/10 rounded text-[10px] font-mono text-white">Esc</kbd> to close
          </span>
          <button
            onClick={onClose}
            className="btn-shine px-5 py-2 rounded-full bg-gradient-to-r from-blurple to-blurple-dark text-white text-xs font-black uppercase tracking-widest shadow-[0_4px_15px_rgba(114,137,218,.35)]"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};

export default TutorialModal;
