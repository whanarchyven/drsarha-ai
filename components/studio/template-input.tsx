"use client";

import { useRef, useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { tokenStyle } from "./utils";

type VariableInfo = { name: string; description?: string };

type TemplateInputProps = {
  value: string;
  onChange: (value: string) => void;
  variables?: Array<VariableInfo>;
  multiline?: boolean;
  placeholder?: string;
  className?: string;
};

export function TemplateInput({
  value,
  onChange,
  variables = [],
  multiline = false,
  placeholder,
  className,
  ...props
}: TemplateInputProps & Omit<React.ComponentProps<"input">, "onChange" | "value" | "ref">) {
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [dropdownFilter, setDropdownFilter] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const filteredVars = variables.filter(
    (v) => !dropdownFilter || v.name.toLowerCase().includes(dropdownFilter.toLowerCase()),
  );

  const insertVariable = useCallback(
    (variableName: string) => {
      const el = inputRef.current;
      if (!el) return;
      const start = el.selectionStart ?? 0;
      const before = value.slice(0, start);
      const after = value.slice(start);
      const lastOpen = before.lastIndexOf("{");
      const prefix = lastOpen >= 0 ? before.slice(0, lastOpen) : before;
      const insertText = `{{${variableName}}}`;
      const newValue = prefix + insertText + after;
      onChange(newValue);
      setShowDropdown(false);
      setTimeout(() => {
        el.focus();
        const newCursor = prefix.length + insertText.length;
        el.setSelectionRange(newCursor, newCursor);
      }, 0);
    },
    [value, onChange],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      const cursor = e.target.selectionStart ?? 0;
      onChange(newValue);

      const before = newValue.slice(0, cursor);
      const lastOpen = before.lastIndexOf("{");
      const lastClose = before.lastIndexOf("}}");
      const hasUnclosedBrace = lastOpen > lastClose && !before.slice(lastOpen).includes("}}");

      if (hasUnclosedBrace && variables.length > 0) {
        setDropdownFilter(before.slice(lastOpen + 1));
        setSelectedIndex(0);
        setShowDropdown(true);
      } else {
        setShowDropdown(false);
      }
    },
    [onChange, variables.length],
  );

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
      if (e.key === "Escape") setShowDropdown(false);
    },
    [showDropdown, filteredVars, selectedIndex, insertVariable],
  );

  const commonProps = {
    value,
    onChange: handleChange,
    onKeyDown: handleKeyDown,
    placeholder,
    className,
    ...props,
  };

  return (
    <div className="relative">
      {multiline ? (
        <Textarea ref={inputRef as unknown as React.Ref<HTMLTextAreaElement>} {...(commonProps as unknown as React.ComponentProps<typeof Textarea>)} />
      ) : (
        <Input ref={inputRef as unknown as React.Ref<HTMLInputElement>} {...commonProps} />
      )}
      {showDropdown && filteredVars.length > 0 && (
        <div className="absolute left-0 top-full z-50 mt-1 max-h-40 w-full overflow-auto rounded-lg border bg-popover shadow-lg">
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
                  style={style}
                >
                  {v.name}
                </span>
                {v.description && <span className="text-xs text-muted-foreground">{v.description}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
