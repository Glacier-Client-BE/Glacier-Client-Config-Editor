
import React, { useRef, useEffect } from 'react';
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

const RawEditor: React.FC<RawEditorProps> = ({ config, onUpdate }) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const monacoEditor = useRef<any>(null);

  useEffect(() => {
    const initMonaco = () => {
      if (!editorRef.current) return;
      
      monacoEditor.current = window.monaco.editor.create(editorRef.current, {
        value: JSON.stringify(config, null, 2),
        language: 'json',
        theme: 'vs-dark',
        automaticLayout: true,
        minimap: { enabled: false },
        fontSize: 13,
        fontFamily: 'JetBrains Mono, Menlo, Monaco, Courier New, monospace',
        padding: { top: 20 },
        backgroundColor: '#1e2124',
        scrollbar: {
          vertical: 'auto',
          horizontal: 'auto',
          useShadows: false,
          verticalScrollbarSize: 8,
          horizontalScrollbarSize: 8,
        },
        lineNumbers: 'on',
        roundedSelection: true,
        cursorSmoothCaretAnimation: 'on',
      });

      monacoEditor.current.onDidChangeModelContent(() => {
        try {
          const val = monacoEditor.current.getValue();
          const parsed = JSON.parse(val);
          onUpdate(parsed);
        } catch (e) {
          // Silent catch for invalid JSON during typing
        }
      });
    };

    if (window.monaco) {
      initMonaco();
    } else {
      window.require.config({ paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs' } });
      window.require(['vs/editor/editor.main'], () => {
        initMonaco();
      });
    }

    return () => {
      if (monacoEditor.current) {
        monacoEditor.current.dispose();
      }
    };
  }, []);

  useEffect(() => {
    if (monacoEditor.current) {
      const currentVal = monacoEditor.current.getValue();
      const newVal = JSON.stringify(config, null, 2);
      if (currentVal !== newVal) {
        monacoEditor.current.setValue(newVal);
      }
    }
  }, [config]);

  return (
    <div className="w-full h-full border-2 border-white/5 rounded-2xl overflow-hidden bg-[#1e2124]">
      <div ref={editorRef} className="w-full h-full" />
    </div>
  );
};

export default RawEditor;
