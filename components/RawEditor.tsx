import React, { useRef, useEffect, useCallback } from 'react';
import { ConfigData } from '../types';

interface RawEditorProps {
  config: ConfigData;
  onUpdate: (newConfig: ConfigData) => void;
}

declare global {
  interface Window {
    require: any;
    monaco: any;
  }
}

const stringify = (cfg: ConfigData) => JSON.stringify(cfg, null, 2);

const RawEditor: React.FC<RawEditorProps> = ({ config, onUpdate }) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const monacoEditor = useRef<any>(null);
  const isInternalChange = useRef(false);
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  const initMonaco = useCallback(() => {
    if (!editorRef.current || monacoEditor.current) return;
    const monaco = window.monaco;

    monaco.editor.defineTheme('glacier', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'string.key.json', foreground: '9ba9ff' },
        { token: 'string.value.json', foreground: '57f287' },
        { token: 'number', foreground: 'eb459e' },
        { token: 'keyword.json', foreground: '7289da' },
      ],
      colors: {
        'editor.background': '#1e2124',
        'editor.foreground': '#e7eaee',
        'editor.lineHighlightBackground': '#282b30',
        'editorLineNumber.foreground': '#5a5e66',
        'editorLineNumber.activeForeground': '#7289da',
        'editor.selectionBackground': '#7289da55',
        'editorIndentGuide.background': '#2e3137',
        'editorIndentGuide.activeBackground': '#3a3f47',
        'editorCursor.foreground': '#9ba9ff',
        'scrollbarSlider.background': '#7289da55',
        'scrollbarSlider.hoverBackground': '#7289da99',
        'scrollbarSlider.activeBackground': '#7289dabb',
      },
    });

    monacoEditor.current = monaco.editor.create(editorRef.current, {
      value: stringify(config),
      language: 'json',
      theme: 'glacier',
      automaticLayout: true,
      minimap: { enabled: false },
      fontSize: 13,
      fontFamily: 'JetBrains Mono, Menlo, Monaco, Courier New, monospace',
      fontLigatures: true,
      padding: { top: 16, bottom: 16 },
      scrollbar: { useShadows: false, verticalScrollbarSize: 10, horizontalScrollbarSize: 10 },
      lineNumbers: 'on',
      roundedSelection: true,
      cursorSmoothCaretAnimation: 'on',
      smoothScrolling: true,
      tabSize: 2,
      wordWrap: 'on',
      formatOnPaste: true,
      bracketPairColorization: { enabled: true },
      guides: { indentation: true, bracketPairs: true },
    });

    monacoEditor.current.onDidChangeModelContent(() => {
      try {
        const val = monacoEditor.current.getValue();
        const parsed = JSON.parse(val);
        isInternalChange.current = true;
        onUpdateRef.current(parsed);
      } catch {
        // ignore intermediate invalid JSON
      }
    });
  }, []);

  useEffect(() => {
    if (window.monaco) {
      initMonaco();
    } else if (window.require) {
      window.require.config({ paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs' } });
      window.require(['vs/editor/editor.main'], () => initMonaco());
    }
    return () => {
      if (monacoEditor.current) {
        monacoEditor.current.dispose();
        monacoEditor.current = null;
      }
    };
  }, [initMonaco]);

  useEffect(() => {
    const editor = monacoEditor.current;
    if (!editor) return;
    if (isInternalChange.current) {
      isInternalChange.current = false;
      return;
    }
    const next = stringify(config);
    if (editor.getValue() !== next) {
      const pos = editor.getPosition();
      editor.setValue(next);
      if (pos) editor.setPosition(pos);
    }
  }, [config]);

  return (
    <div className="w-full h-full border border-white/5 rounded-2xl overflow-hidden bg-glacier-black shadow-inner">
      <div ref={editorRef} className="w-full h-full" />
    </div>
  );
};

export default RawEditor;
