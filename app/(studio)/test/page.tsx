"use client";

import { useEffect, useState } from "react";
import { useAction, useQuery } from "convex/react";
import { useSearchParams } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { isRecord, prettyJson } from "@/components/studio/utils";
import { toast } from "sonner";
import { PlayCircle, Play, FileJson, Terminal, ChevronDown } from "lucide-react";

function extractOutputText(result: unknown): string | null {
  if (!isRecord(result) || !isRecord(result.output)) {
    return null;
  }

  const outputRoot = result.output;
  if (!Array.isArray(outputRoot.output)) {
    return null;
  }

  const textParts: Array<string> = [];
  for (const message of outputRoot.output) {
    if (!isRecord(message) || !Array.isArray(message.content)) {
      continue;
    }
    for (const part of message.content) {
      if (isRecord(part) && part.type === "output_text" && typeof part.text === "string") {
        textParts.push(part.text);
      }
    }
  }

  return textParts.length > 0 ? textParts.join("\n\n") : null;
}

export default function TestPage() {
  const searchParams = useSearchParams();
  const initialMethod = searchParams.get("method") ?? "";
  const methods = useQuery(api.methods.list) ?? [];
  const runMethod = useAction(api.methods.runMethod);

  const [methodName, setMethodName] = useState(initialMethod);
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const selectedMethod = methods.find((method) => method.name === methodName) ?? null;
  const rawOutput =
    result !== null && isRecord(result) && "output" in result ? result.output : null;
  const displayValue =
    typeof rawOutput === "string"
      ? rawOutput
      : extractOutputText(result) ?? (result !== null ? prettyJson(result) : null);

  const isBase64Image = (s: string) => {
    const clean = s.replace(/\s/g, "");
    return /^[A-Za-z0-9+/]+=*$/.test(clean) && clean.length > 100 && !s.trimStart().startsWith("{") && !s.trimStart().startsWith("[");
  };

  useEffect(() => {
    if (!methodName && initialMethod) {
      setMethodName(initialMethod);
    }
  }, [initialMethod, methodName]);

  const onRun = async () => {
    if (!methodName.trim()) {
      setError("Выберите метод");
      toast.error("Выберите метод");
      return;
    }
    const inputData: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(inputValues)) {
      if (v.trim() !== "") inputData[k] = v.trim();
    }
    setError("");
    setResult(null);
    setRunning(true);
    try {
      const response = await runMethod({ methodName: methodName.trim(), inputData });
      setResult(response);
      toast.success("Метод выполнен");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка выполнения");
      toast.error(err instanceof Error ? err.message : "Ошибка выполнения");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <PlayCircle className="h-7 w-7 text-emerald-500" />
          <span className="page-header-gradient">Тест запуска метода</span>
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Запустите метод с произвольными входными данными</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
      <Card className="card-gradient-border shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileJson className="h-5 w-5 text-violet-500" />
            Входные данные
          </CardTitle>
          <CardDescription>Заполните поля для входа в метод</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Метод</Label>
            <Select value={methodName} onValueChange={setMethodName}>
              <SelectTrigger>
                <SelectValue placeholder="Выберите метод" />
              </SelectTrigger>
              <SelectContent>
                {methods.map((method) => (
                  <SelectItem key={method._id} value={method.name}>
                    {method.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Входные данные</Label>
            {selectedMethod && selectedMethod.inputs.length > 0 ? (
              <div className="space-y-3">
                {selectedMethod.inputs.map((input) => (
                  <div key={input.name} className="space-y-1">
                    <Label htmlFor={`input-${input.name}`} className="text-xs font-mono">
                      {input.name}
                    </Label>
                    <Textarea
                      id={`input-${input.name}`}
                      value={inputValues[input.name] ?? ""}
                      onChange={(e) => setInputValues((p) => ({ ...p, [input.name]: e.target.value }))}
                      placeholder={input.description || input.name}
                      className="font-mono text-sm min-h-20"
                      rows={3}
                    />
                  </div>
                ))}
              </div>
            ) : selectedMethod ? (
              <p className="text-sm text-muted-foreground">У метода нет объявленных input.</p>
            ) : null}
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button
            onClick={() => void onRun()}
            disabled={running}
            className="gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 shadow-lg shadow-emerald-500/25 hover:from-emerald-700 hover:to-teal-700"
          >
            {running ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Выполняю...
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                Запустить
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card className="card-gradient-border shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Terminal className="h-5 w-5 text-emerald-500" />
            Результат
          </CardTitle>
        </CardHeader>
        <CardContent>
          {result === null ? (
            <pre className="max-h-[640px] overflow-auto rounded-lg border bg-muted/30 p-4 text-xs">
              Запустите метод.
            </pre>
          ) : typeof displayValue === "string" && isBase64Image(displayValue) ? (
            <div className="max-h-[640px] overflow-auto rounded-lg border bg-muted/30 p-4">
              <img
                src={`data:image/png;base64,${displayValue.replace(/\s/g, "")}`}
                alt="Сгенерированное изображение"
                className="max-w-full rounded-lg"
              />
            </div>
          ) : typeof displayValue === "string" && !displayValue.trimStart().startsWith("{") && !displayValue.trimStart().startsWith("[") ? (
            <div className="max-h-[640px] overflow-auto rounded-lg border bg-muted/30 p-4">
              <div className="whitespace-pre-wrap text-sm leading-6">{displayValue}</div>
            </div>
          ) : (
            <pre className="max-h-[640px] overflow-auto rounded-lg border bg-muted/30 p-4 text-xs">
              {displayValue}
            </pre>
          )}
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
