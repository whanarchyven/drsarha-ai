"use client";

import type { ReactNode } from "react";
import { Textarea } from "@/components/ui/textarea";
import { tokenStyle } from "./utils";

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
          borderColor: style.borderColor,
        }}
        className="rounded-md border px-1 py-0.5 font-medium"
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
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-40 font-mono text-sm"
        placeholder="Введите prompt..."
      />
      <div className="rounded-lg border bg-muted/30 p-3">
        <p className="mb-2 text-xs text-muted-foreground">Preview подсветки переменных</p>
        <div className="whitespace-pre-wrap break-words font-mono text-sm leading-6">
          {promptToHighlightedNodes(value)}
        </div>
      </div>
    </div>
  );
}
