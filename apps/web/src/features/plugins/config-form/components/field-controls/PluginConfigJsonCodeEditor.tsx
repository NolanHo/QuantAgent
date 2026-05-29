import { EditorState } from "@codemirror/state";
import { json } from "@codemirror/lang-json";
import { basicSetup, EditorView } from "codemirror";
import { useEffect, useRef } from "react";

import type { PluginConfigFieldDefinition } from "../../types";

const codeEditorWrapClassName =
  "overflow-hidden rounded-[22px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] shadow-sm";

type PluginConfigJsonCodeEditorProps = {
  definition: PluginConfigFieldDefinition;
  onChange: (path: string, nextValue: string) => void;
  value: string;
};

export function PluginConfigJsonCodeEditor({
  definition,
  onChange,
  value,
}: PluginConfigJsonCodeEditorProps) {
  const editorHostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const isApplyingExternalUpdateRef = useRef(false);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!editorHostRef.current) {
      return;
    }

    const view = new EditorView({
      parent: editorHostRef.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          basicSetup,
          json(),
          EditorView.lineWrapping,
          EditorView.contentAttributes.of({
            "aria-label": definition.label,
            spellcheck: "false",
          }),
          EditorView.theme({
            "&": {
              backgroundColor: "transparent",
              fontSize: "12px",
              minHeight: "168px",
            },
            ".cm-scroller": {
              fontFamily:
                'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
              lineHeight: "1.5rem",
              minHeight: "168px",
              overflow: "auto",
            },
            ".cm-content": {
              minHeight: "168px",
              padding: "1rem",
              caretColor: "#0f172a",
              color: "#0f172a",
            },
            ".cm-focused": {
              outline: "none",
            },
            ".cm-activeLine": {
              backgroundColor: "rgba(148, 163, 184, 0.10)",
            },
            ".cm-selectionBackground, ::selection": {
              backgroundColor: "rgba(59, 130, 246, 0.18)",
            },
            ".cm-gutters": {
              display: "none",
            },
            ".cm-line": {
              color: "#0f172a",
            },
          }),
          EditorView.updateListener.of((update) => {
            if (!update.docChanged || isApplyingExternalUpdateRef.current) {
              return;
            }

            onChangeRef.current(definition.path, update.state.doc.toString());
          }),
        ],
      }),
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [definition.label, definition.path]);

  useEffect(() => {
    const view = viewRef.current;

    if (!view) {
      return;
    }

    const currentValue = view.state.doc.toString();

    if (currentValue === value) {
      return;
    }

    isApplyingExternalUpdateRef.current = true;
    view.dispatch({
      changes: {
        from: 0,
        to: currentValue.length,
        insert: value,
      },
    });
    isApplyingExternalUpdateRef.current = false;
  }, [value]);

  return (
    <div className={codeEditorWrapClassName}>
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-300" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
        </div>
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          JSON
        </span>
      </div>
      <div ref={editorHostRef} className="min-h-[168px]" />
    </div>
  );
}
