"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import type { ReactNode } from "react";
import { Textarea } from "@/components/ui/textarea";
import { tokenStyle } from "./utils";

export type VariableInfo = { name: string; description: string; source?: string };

function promptToHighlightedNodes(prompt: string): ReactNode {
  const regex = /{{\s*([\w.]+)\s*}}/g;
  const nodes: Array<ReactNode> = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null = regex.exec(prompt);

  while (match) {
    if (match.index > lastIndex) {
      nodes.push(prompt.slice(lastIndex, match.index));
    }
    const token = match[1];
    const style = tokenStyle(token);
    nodes.push(
      <span
        key={`${token}-${match.index}`}
        style={{
          backgroundColor: style.backgroundColor,
          color: style.color,
        }}
      >
        {match[0]}
      </span>,
    );
    lastIndex = match.index + match[0].length;
    match = regex.exec(prompt);
  }

  if (lastIndex < prompt.length) {
    nodes.push(prompt.slice(lastIndex));
  }

  return <>{nodes}</>;
}

export default function PromptEditor({
  value,
  onChange,
  variables = [],
}: {
  value: string;
  onChange: (next: string) => void;
  variables?: Array<VariableInfo>;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
  const [dropdownFilter, setDropdownFilter] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const filteredVars = variables.filter(
    (v) => !dropdownFilter || v.name.toLowerCase().includes(dropdownFilter.toLowerCase()),
  );

  const insertVariable = useCallback(
    (variableName: string) => {
      const ta = textareaRef.current;
      if (!ta) return;
      const start = ta.selectionStart;
      const before = value.slice(0, start);
      const after = value.slice(start);
      const lastOpen = before.lastIndexOf("{");
      const prefix = lastOpen >= 0 ? before.slice(0, lastOpen) : before;
      const insertText = `{{${variableName}}}`;
      const newValue = prefix + insertText + after;
      onChange(newValue);
      setShowDropdown(false);
      setTimeout(() => {
        ta.focus();
        const newCursor = prefix.length + insertText.length;
        ta.setSelectionRange(newCursor, newCursor);
      }, 0);
    },
    [value, onChange],
  );

  useEffect(() => {
    if (!showDropdown) return;
    const ta = textareaRef.current;
    if (!ta) return;
    const rect = ta.getBoundingClientRect();
    setDropdownPos({ top: rect.bottom + 4, left: rect.left });
  }, [showDropdown, value]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      const cursor = e.target.selectionStart ?? 0;
      onChange(newValue);

      const before = newValue.slice(0, cursor);
      const lastOpen = before.lastIndexOf("{");
      const lastClose = before.lastIndexOf("}}");
      const hasUnclosedBrace = lastOpen > lastClose && !before.slice(lastOpen).includes("}}");

      if (hasUnclosedBrace && variables.length > 0) {
        const afterBrace = before.slice(lastOpen + 1);
        setDropdownFilter(afterBrace);
        setSelectedIndex(0);
        setShowDropdown(true);
      } else {
        setShowDropdown(false);
      }
    },
    [onChange, variables.length],
  );

  const handleScroll = useCallback(() => {
    if (textareaRef.current && highlightRef.current) {
      highlightRef.current.scrollTop = textareaRef.current.scrollTop;
      highlightRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!showDropdown || filteredVars.length === 0) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filteredVars.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertVariable(filteredVars[selectedIndex]?.name ?? "");
        return;
      }
      if (e.key === "Escape") {
        setShowDropdown(false);
      }
    },
    [showDropdown, filteredVars, selectedIndex, insertVariable],
  );

  return (
    <div className="space-y-2">
      {variables.length > 0 && (
        <div className="rounded-lg border bg-muted/30 p-3">
          <p className="mb-2 text-xs font-medium text-muted-foreground">Доступные переменные</p>
          <div className="flex flex-col gap-1.5">
            {variables.map((v, i) => {
              const style = tokenStyle(v.name);
              const desc = v.description || (v.source && !v.description ? v.source : "");
              return (
                <div key={`${v.name}-${i}`} className="flex gap-4 items-baseline min-w-0">
                  <span
                    className="inline-flex items-center rounded-md border px-2 py-0.5 font-mono text-xs shrink-0"
                    style={style}
                  >
                    {v.name}
                  </span>
                  {desc ? (
                    <span className="text-[10px] text-muted-foreground break-words min-w-0">{desc}</span>
                  ) : (
                    <span className="text-[10px] text-muted-foreground/50 italic shrink-0">—</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="relative min-h-40 overflow-hidden rounded-md border bg-background shadow-xs focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
        <div
          ref={highlightRef}
          className="pointer-events-none absolute inset-0 overflow-auto px-3 py-2 font-mono text-sm leading-6 whitespace-pre-wrap break-words [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-hidden
        >
          {promptToHighlightedNodes(value || "\u00A0")}
        </div>
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onScroll={handleScroll}
          className="relative z-10 min-h-40 border-0 bg-transparent font-mono text-sm leading-6 [-webkit-text-fill-color:transparent] [color:transparent] placeholder:[-webkit-text-fill-color:initial] placeholder:[color:initial] selection:bg-primary/20 focus-visible:ring-0"
          placeholder="Введите prompt... Нажмите { для выбора переменной"
          style={{ caretColor: "var(--foreground)" }}
        />
        {showDropdown && filteredVars.length > 0 && (
          <div
            className="fixed z-50 max-h-48 w-64 overflow-auto rounded-lg border bg-popover shadow-lg"
            style={{ top: dropdownPos.top, left: dropdownPos.left }}
          >
            {filteredVars.map((v, i) => {
              const style = tokenStyle(v.name);
              return (
                <button
                  key={v.name}
                  type="button"
                  className={`flex w-full flex-col gap-0.5 px-3 py-2 text-left text-sm hover:bg-muted ${
                    i === selectedIndex ? "bg-muted" : ""
                  }`}
                  onClick={() => insertVariable(v.name)}
                  onMouseEnter={() => setSelectedIndex(i)}
                >
                  <span
                    className="inline-flex w-fit rounded border px-1.5 py-0.5 font-mono text-xs"
                    style={{
                      backgroundColor: style.backgroundColor,
                      color: style.color,
                      borderColor: style.borderColor,
                    }}
                  >
                    {v.name}
                  </span>
                  {(v.description || v.source) && (
                    <span className="text-xs text-muted-foreground">{v.description || v.source}</span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
