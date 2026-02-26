"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useMutation, useQuery, useAction } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Zap, Save, ArrowLeft, Plus, Trash2, Play, ChevronDown } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import PromptEditor from "./prompt-editor";
import { TemplateInput } from "./template-input";
import { extractPromptTokens, isRecord, safeParseJson, prettyJson, tokenStyle } from "./utils";

type MethodDoc = Doc<"methods">;
type MethodVariable = MethodDoc["variables"][number];
type MethodInput = MethodDoc["inputs"][number];
type HttpVerb = "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "OPTIONS";

type InputDraft = { id: string; name: string; description: string; active: boolean };
type VariableDraft = {
  id: string;
  type: "literal" | "function";
  name: string;
  description: string;
  active: boolean;
  valueText: string;
  url: string;
  method: HttpVerb;
  payloadText: string;
  headersText: string;
  extractedVars: Array<{ id: string; path: string; varName: string; description: string; active: boolean }>;
};

const HTTP_METHODS: Array<HttpVerb> = ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"];

function createDraftId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

function createDefaultInputDraft(): InputDraft {
  return { id: createDraftId(), name: "", description: "", active: true };
}

function createDefaultVariableDraft(): VariableDraft {
  return {
    id: createDraftId(),
    type: "literal",
    name: "",
    description: "",
    active: true,
    valueText: "",
    url: "",
    method: "POST",
    payloadText: "{}",
    headersText: "{}",
    extractedVars: [],
  };
}

function normalizeInputs(inputs: MethodDoc["inputs"]): Array<InputDraft> {
  if (!inputs || inputs.length === 0) return [];
  const first = inputs[0];
  if (typeof first === "string") {
    return (inputs as unknown as string[]).map((s) => ({
      id: createDraftId(),
      name: s,
      description: "",
      active: true,
    }));
  }
  return inputs.map((i) => ({
    id: createDraftId(),
    name: i.name,
    description: i.description ?? "",
    active: i.active ?? true,
  }));
}

function toDraftVariables(variables: Array<MethodVariable>): Array<VariableDraft> {
  return variables.map((variable) => {
    if (variable.type === "literal") {
      return {
        id: createDraftId(),
        type: "literal",
        name: variable.name,
        description: variable.description ?? "",
        active: variable.active ?? true,
        valueText: typeof variable.value === "string" ? variable.value : prettyJson(variable.value),
        url: "",
        method: "POST",
        payloadText: "{}",
        headersText: "{}",
        extractedVars: [],
      };
    }
    return {
      id: createDraftId(),
      type: "function",
      name: variable.name,
      description: variable.description ?? "",
      active: variable.active ?? true,
      valueText: "",
      url: variable.url,
      method: variable.method.toUpperCase() as HttpVerb,
      payloadText: prettyJson(variable.payload),
      headersText: prettyJson(variable.headers),
      extractedVars: (variable.extractedVars ?? []).map((ev) => ({
        id: createDraftId(),
        path: ev.path,
        varName: ev.varName,
        description: ev.description ?? "",
        active: ev.active ?? true,
      })),
    };
  });
}

function parseLiteralValue(valueText: string): unknown {
  if (!valueText.trim()) return "";
  const parsed = safeParseJson(valueText);
  if (parsed.ok) return parsed.value;
  return valueText;
}

function buildVariableFromDraft(draft: VariableDraft): { ok: true; value: MethodVariable } | { ok: false; error: string } {
  const name = draft.name.trim();
  if (!name) return { ok: false, error: "Имя переменной обязательно" };
  if (draft.type === "literal") {
    return {
      ok: true,
      value: {
        type: "literal",
        name,
        description: draft.description.trim() || undefined,
        active: draft.active,
        value: parseLiteralValue(draft.valueText),
      },
    };
  }
  if (!draft.url.trim()) return { ok: false, error: `У переменной "${name}" не заполнен URL` };
  const payloadParsed = safeParseJson(draft.payloadText || "{}");
  if (!payloadParsed.ok) return { ok: false, error: `Некорректный payload в "${name}": ${payloadParsed.error}` };
  const headersParsed = safeParseJson(draft.headersText || "{}");
  if (!headersParsed.ok) return { ok: false, error: `Некорректный headers в "${name}": ${headersParsed.error}` };
  if (!isRecord(headersParsed.value)) return { ok: false, error: `Headers в "${name}" должны быть объектом` };
  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(headersParsed.value)) {
    headers[key] = typeof value === "string" ? value : String(value);
  }
  const extractedVars = draft.extractedVars
    .filter((ev) => ev.path.trim() && ev.varName.trim())
    .map((ev) => ({
      path: ev.path.trim(),
      varName: ev.varName.trim(),
      description: ev.description.trim() || undefined,
      active: ev.active,
    }));
  return {
    ok: true,
    value: {
      type: "function",
      name,
      description: draft.description.trim() || undefined,
      active: draft.active,
      url: draft.url.trim(),
      method: draft.method,
      payload: payloadParsed.value,
      headers,
      extractedVars: extractedVars.length > 0 ? extractedVars : undefined,
    },
  };
}

export default function MethodForm({ methodId }: { methodId?: Id<"methods"> }) {
  const router = useRouter();
  const role = useQuery(api.users.getMyRole);
  const isModerator = role === "moderator";
  const models = useQuery(api.models.list) ?? [];
  const method = useQuery(api.methods.getById, methodId ? { id: methodId } : "skip");
  const createMethod = useMutation(api.methods.create);
  const updateMethod = useMutation(api.methods.update);
  const testFunction = useAction(api.methods.testFunction);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [modelId, setModelId] = useState("");
  const [inputs, setInputs] = useState<Array<InputDraft>>([]);
  const [outputFormat, setOutputFormat] = useState("JSON");
  const [settingsText, setSettingsText] = useState("{}");
  const [prompt, setPrompt] = useState("");
  const [variables, setVariables] = useState<Array<VariableDraft>>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!method) return;
    setName(method.name);
    setDescription(method.description ?? "");
    setModelId(method.modelId);
    setInputs(normalizeInputs(method.inputs));
    setOutputFormat(method.outputFormat);
    setSettingsText(method.settings === undefined ? "{}" : prettyJson(method.settings));
    setPrompt(method.prompt);
    setVariables(toDraftVariables(method.variables));
  }, [method]);

  const knownPromptVariables = useMemo(() => {
    const fromInputs = inputs.map((i) => i.name.trim()).filter(Boolean);
    const fromVars = variables.flatMap((v) => {
      const names = [v.name.trim()];
      if (v.type === "function") {
        names.push(...v.extractedVars.map((ev) => ev.varName.trim()).filter(Boolean));
      }
      return names;
    });
    const fromPrompt = extractPromptTokens(prompt);
    return Array.from(new Set([...fromInputs, ...fromVars, ...fromPrompt]));
  }, [inputs, variables, prompt]);

  const variablesWithDescriptions = useMemo(() => {
    const items: Array<{ name: string; description: string; source: string }> = [];
    for (const i of inputs) {
      if (i.name.trim() && i.active) items.push({ name: i.name.trim(), description: i.description.trim(), source: "input" });
    }
    for (const v of variables) {
      if (v.name.trim() && v.active) items.push({ name: v.name.trim(), description: v.description.trim(), source: "variable" });
      if (v.type === "function") {
        for (const ev of v.extractedVars) {
          if (ev.varName.trim() && ev.active) items.push({ name: ev.varName.trim(), description: ev.description.trim(), source: `из ${v.name}` });
        }
      }
    }
    return items;
  }, [inputs, variables]);

  const onSave = async () => {
    if (!name.trim()) {
      setError("Нужно заполнить name");
      toast.error("Нужно заполнить name");
      return;
    }
    if (!modelId) {
      setError("Нужно выбрать модель");
      toast.error("Нужно выбрать модель");
      return;
    }
    const parsedSettings = safeParseJson(settingsText || "{}");
    if (!parsedSettings.ok) {
      setError(`Некорректный settings JSON: ${parsedSettings.error}`);
      toast.error(`Некорректный settings JSON: ${parsedSettings.error}`);
      return;
    }
    const builtVariables: Array<MethodVariable> = [];
    for (const variable of variables) {
      const built = buildVariableFromDraft(variable);
      if (!built.ok) {
        setError(built.error);
        toast.error(built.error);
        return;
      }
      builtVariables.push(built.value);
    }
    setError("");
    setSaving(true);
    const inputList = inputs
      .filter((i) => i.name.trim())
      .map((i) => ({ name: i.name.trim(), description: i.description.trim() || undefined, active: i.active }));

    try {
      if (methodId) {
        await updateMethod({
          id: methodId,
          name: name.trim(),
          description: description.trim() || undefined,
          modelId: modelId as Id<"models">,
          prompt,
          outputFormat,
          inputs: inputList,
          settings: parsedSettings.value,
          variables: builtVariables,
        });
        toast.success("Метод обновлён");
      } else {
        await createMethod({
          name: name.trim(),
          description: description.trim() || undefined,
          modelId: modelId as Id<"models">,
          prompt,
          outputFormat,
          inputs: inputList,
          settings: parsedSettings.value,
          variables: builtVariables,
        });
        toast.success("Метод создан");
      }
      router.push("/methods");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка сохранения метода");
      toast.error(err instanceof Error ? err.message : "Ошибка сохранения метода");
    } finally {
      setSaving(false);
    }
  };

  const runTestFunction = useCallback(
    async (variable: VariableDraft, testContext: Record<string, unknown>) => {
      if (variable.type !== "function" || !variable.url.trim()) return null;
      const payloadParsed = safeParseJson(variable.payloadText || "{}");
      const headersParsed = safeParseJson(variable.headersText || "{}");
      if (!payloadParsed.ok || !headersParsed.ok) return null;
      const headers: Record<string, string> = {};
      if (isRecord(headersParsed.value)) {
        for (const [k, v] of Object.entries(headersParsed.value)) headers[k] = String(v);
      }
      try {
        return await testFunction({
          url: variable.url,
          method: variable.method,
          payload: payloadParsed.value,
          headers,
          context: testContext,
        });
      } catch {
        return null;
      }
    },
    [testFunction],
  );

  if (isModerator) {
    if (!methodId || !method) return <p className="text-sm text-muted-foreground">Метод не найден</p>;
    return (
      <div className="space-y-6">
        <header>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Zap className="h-7 w-7 text-amber-500" />
            <span className="page-header-gradient">Редактор промпта: {method.name}</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Редактирование промпта метода</p>
        </header>
        <Card className="card-gradient-border shadow-md">
          <CardContent className="space-y-5 pt-6">
            <div className="space-y-3">
              <Label>Редактор промпта</Label>
              <PromptEditor
                value={prompt}
                onChange={setPrompt}
                variables={variablesWithDescriptions}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-2">
              <Button
                onClick={async () => {
                  setError("");
                  setSaving(true);
                  try {
                    await updateMethod({ id: methodId, prompt });
                    toast.success("Промпт сохранён");
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Ошибка");
                    toast.error(err instanceof Error ? err.message : "Ошибка");
                  } finally {
                    setSaving(false);
                  }
                }}
                disabled={saving}
                className="gap-2 bg-gradient-to-r from-amber-500 to-orange-500"
              >
                {saving ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <Save className="h-4 w-4" />}
                {saving ? "Сохраняю..." : "Сохранить"}
              </Button>
              <Button variant="outline" onClick={() => router.push("/methods")} className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Отмена
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Zap className="h-7 w-7 text-amber-500" />
          <span className="page-header-gradient">{methodId ? "Редактирование метода" : "Создание метода"}</span>
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Заполните шаги сверху вниз, prompt находится в самом конце</p>
      </header>
      <Card className="card-gradient-border shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-500" />
            Параметры метода
          </CardTitle>
          <CardDescription>Заполните шаги сверху вниз, prompt находится в самом конце.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Название метода</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Модель</Label>
              <Select value={modelId} onValueChange={setModelId}>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите модель" />
                </SelectTrigger>
                <SelectContent>
                  {models.map((model) => (
                    <SelectItem key={model._id} value={model._id}>
                      {model.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Описание метода</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Краткое описание метода" rows={2} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Формат вывода</Label>
              <Textarea value={outputFormat} onChange={(e) => setOutputFormat(e.target.value)} />
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Входные параметры</Label>
              <Button variant="outline" size="sm" onClick={() => setInputs((p) => [...p, createDefaultInputDraft()])} className="gap-1.5">
                <Plus className="h-4 w-4" />
                Добавить
              </Button>
            </div>
            {inputs.length === 0 && <p className="text-sm text-muted-foreground">Параметры пока не добавлены.</p>}
            <div className="space-y-3">
              {inputs.map((input, idx) => (
                <Card key={input.id} className="border border-dashed border-violet-200/60 dark:border-violet-800/40">
                  <CardContent className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-end">
                    <Checkbox
                      checked={input.active}
                      onCheckedChange={(checked) => setInputs((p) => p.map((x, i) => (i === idx ? { ...x, active: checked === true } : x)))}
                      className="shrink-0"
                    />
                    <div className="flex-1 space-y-2">
                      <Label>Имя</Label>
                      <Input
                        value={input.name}
                        onChange={(e) => setInputs((p) => p.map((x, i) => (i === idx ? { ...x, name: e.target.value } : x)))}
                        placeholder="theme"
                      />
                    </div>
                    <div className="flex-1 space-y-2">
                      <Label>Описание</Label>
                      <Input
                        value={input.description}
                        onChange={(e) => setInputs((p) => p.map((x, i) => (i === idx ? { ...x, description: e.target.value } : x)))}
                        placeholder="Тема запроса"
                      />
                    </div>
                    <Button variant="destructive" size="sm" onClick={() => setInputs((p) => p.filter((_, i) => i !== idx))} className="gap-1.5 shrink-0">
                      <Trash2 className="h-3.5 w-3.5" />
                      Удалить
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Переменные</Label>
              <Button variant="outline" size="sm" onClick={() => setVariables((p) => [...p, createDefaultVariableDraft()])} className="gap-1.5">
                <Plus className="h-4 w-4" />
                Добавить
              </Button>
            </div>
            {variables.length === 0 && <p className="text-sm text-muted-foreground">Переменные пока не добавлены.</p>}
            <div className="space-y-3">
              {variables.map((variable, index) => {
              const availableForFunction = [
                ...inputs.filter((i) => i.name.trim()).map((i) => ({ name: i.name.trim(), description: i.description.trim() || undefined })),
                ...variables
                  .filter((v) => v.type === "literal" && v.name.trim())
                  .map((v) => ({ name: v.name.trim(), description: v.description.trim() || undefined })),
              ];
              return (
                <FunctionVariableCard
                  key={variable.id}
                  variable={variable}
                  index={index}
                  setVariables={setVariables}
                  runTestFunction={runTestFunction}
                  availableVariables={availableForFunction}
                />
              );
            })}
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>Доп. параметры OpenAI (опционально)</Label>
            <p className="text-xs text-muted-foreground">Можно оставить пустой объект {"{}"}. Поддерживается JSON/JSON5.</p>
            <Textarea value={settingsText} onChange={(e) => setSettingsText(e.target.value)} className="font-mono text-xs" />
          </div>

          <Separator />

          <div className="space-y-3">
            <Label>Редактор промпта</Label>
            <PromptEditor
              value={prompt}
              onChange={setPrompt}
              variables={variablesWithDescriptions}
            />
            
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button onClick={() => void onSave()} disabled={saving} className="gap-2 bg-gradient-to-r from-amber-500 to-orange-500 shadow-lg shadow-amber-500/25 hover:from-amber-600 hover:to-orange-600">
              {saving ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <Save className="h-4 w-4" />}
              {saving ? "Сохраняю..." : "Сохранить"}
            </Button>
            <Button variant="outline" onClick={() => router.push("/methods")} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Отмена
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function FunctionVariableCard({
  variable,
  index,
  setVariables,
  runTestFunction,
  availableVariables,
}: {
  variable: VariableDraft;
  index: number;
  setVariables: React.Dispatch<React.SetStateAction<VariableDraft[]>>;
  runTestFunction: (v: VariableDraft, testContext: Record<string, unknown>) => Promise<unknown>;
  availableVariables: Array<{ name: string; description?: string }>;
}) {
  const [testOutput, setTestOutput] = useState<unknown>(null);
  const [testing, setTesting] = useState(false);

  const [testContextText, setTestContextText] = useState("{}");

  const handleTest = async () => {
    setTesting(true);
    setTestOutput(null);
    const ctxParsed = safeParseJson(testContextText || "{}");
    const testContext = ctxParsed.ok && isRecord(ctxParsed.value) ? (ctxParsed.value as Record<string, unknown>) : {};
    try {
      const result = await runTestFunction(variable, testContext);
      setTestOutput(result);
      if (result === null) toast.error("Ошибка выполнения функции");
    } finally {
      setTesting(false);
    }
  };

  const upd = (fn: (v: VariableDraft) => VariableDraft) =>
    setVariables((p) => p.map((x, i) => (i === index ? fn(x) : x)));

  if (variable.type === "literal") {
    return (
      <Card className="border border-dashed border-violet-200/60 dark:border-violet-800/40">
        <CardContent className="space-y-3 pt-5">
          <Checkbox
            checked={variable.active}
            onCheckedChange={(checked) => upd((v) => ({ ...v, active: checked === true }))}
            className="shrink-0"
          />
          <div className="grid gap-3 md:grid-cols-4">
            <div className="space-y-2 md:col-span-2">
              <Label>Имя</Label>
              <Input value={variable.name} onChange={(e) => upd((v) => ({ ...v, name: e.target.value }))} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Тип</Label>
              <Select
                value={variable.type}
                onValueChange={(next) => upd((v) => ({ ...v, type: next as "literal" | "function" }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="literal">Константа</SelectItem>
                  <SelectItem value="function">Функция</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Описание</Label>
            <Input value={variable.description} onChange={(e) => upd((v) => ({ ...v, description: e.target.value }))} placeholder="Описание переменной" />
          </div>
          <div className="space-y-2">
            <Label>Значение (строка или JSON)</Label>
            <Textarea value={variable.valueText} onChange={(e) => upd((v) => ({ ...v, valueText: e.target.value }))} />
          </div>
          <Button variant="destructive" size="sm" onClick={() => setVariables((p) => p.filter((_, i) => i !== index))} className="gap-1.5">
            <Trash2 className="h-3.5 w-3.5" />
            Удалить переменную
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-dashed border-violet-200/60 dark:border-violet-800/40">
      <CardContent className="space-y-3 pt-5">
        <Checkbox
          checked={variable.active}
          onCheckedChange={(checked) => upd((v) => ({ ...v, active: checked === true }))}
          className="shrink-0"
        />
        <div className="grid gap-3 md:grid-cols-4">
          <div className="space-y-2 md:col-span-2">
            <Label>Имя</Label>
            <Input value={variable.name} onChange={(e) => upd((v) => ({ ...v, name: e.target.value }))} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Тип</Label>
            <Select value={variable.type} onValueChange={(next) => upd((v) => ({ ...v, type: next as "literal" | "function" }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="literal">Константа</SelectItem>
                <SelectItem value="function">Функция</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Описание</Label>
          <Input value={variable.description} onChange={(e) => upd((v) => ({ ...v, description: e.target.value }))} placeholder="Описание переменной" />
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="space-y-2 md:col-span-2">
            <Label>URL функции</Label>
            <TemplateInput
              value={variable.url}
              onChange={(url: string) => upd((v) => ({ ...v, url }))}
              variables={availableVariables}
              placeholder="https://api.example.com/{{theme}}?page=1"
              className="font-mono"
            />
            {availableVariables.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Доступны: {availableVariables.map((v) => `{{${v.name}}}`).join(", ")}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label>HTTP метод</Label>
            <Select value={variable.method} onValueChange={(next) => upd((v) => ({ ...v, method: next as HttpVerb }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {HTTP_METHODS.map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Payload JSON</Label>
            <TemplateInput
              value={variable.payloadText}
              onChange={(payloadText: string) => upd((v) => ({ ...v, payloadText }))}
              variables={availableVariables}
              multiline
              className="font-mono text-xs min-h-24"
            />
            {availableVariables.length > 0 && (
              <p className="text-xs text-muted-foreground">Можно использовать {"{{variable}}"}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Headers JSON</Label>
            <TemplateInput
              value={variable.headersText}
              onChange={(headersText: string) => upd((v) => ({ ...v, headersText }))}
              variables={availableVariables}
              multiline
              className="font-mono text-xs min-h-24"
            />
            {availableVariables.length > 0 && (
              <p className="text-xs text-muted-foreground">Можно использовать {"{{variable}}"}</p>
            )}
          </div>
        </div>

        {availableVariables.length > 0 && (
          <div className="space-y-2">
            <Label>Контекст для теста (JSON)</Label>
            <p className="text-xs text-muted-foreground">Значения для подстановки в URL, payload, headers. Например: {`{"theme": "test"}`}</p>
            <Input
              value={testContextText}
              onChange={(e) => setTestContextText(e.target.value)}
              placeholder='{"theme": "test"}'
              className="font-mono text-xs"
            />
          </div>
        )}
        <div className="flex flex-col gap-3">
          <Button variant="outline" size="sm" onClick={() => void handleTest()} disabled={testing} className="w-fit gap-1.5 shrink-0">
            {testing ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <Play className="h-4 w-4" />}
            {testing ? "Выполняю..." : "Протестировать"}
          </Button>
          <div className="min-h-20 w-full min-w-0 overflow-hidden rounded-lg border bg-muted/30 p-3">
            <p className="mb-1 text-xs text-muted-foreground">Результат функции</p>
            <pre className="max-h-40 overflow-auto text-xs">{testOutput !== null ? prettyJson(testOutput) : "Нажмите «Протестировать»"}</pre>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Извлечённые переменные (путь → имя для {"{{имя}}"})</Label>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs"
              onClick={() => upd((v) => ({ ...v, extractedVars: [...v.extractedVars, { id: createDraftId(), path: "", varName: "", description: "", active: true }] }))}
            >
              <Plus className="h-3 w-3" />
              Добавить
            </Button>
          </div>
          {variable.extractedVars.map((ev, evIdx) => (
            <div key={ev.id} className="flex flex-wrap items-center gap-2">
              <Checkbox
                checked={ev.active}
                onCheckedChange={(checked) =>
                  upd((v) => ({
                    ...v,
                    extractedVars: v.extractedVars.map((x, i) => (i === evIdx ? { ...x, active: checked === true } : x)),
                  }))
                }
                className="shrink-0"
              />
              <Input
                value={ev.path}
                onChange={(e) =>
                  upd((v) => ({
                    ...v,
                    extractedVars: v.extractedVars.map((x, i) => (i === evIdx ? { ...x, path: e.target.value } : x)),
                  }))
                }
                placeholder="user.email"
                className="font-mono text-sm w-52"
              />
              <ChevronDown className="h-4 w-4 shrink-0 -rotate-90 text-muted-foreground" />
              <Input
                value={ev.varName}
                onChange={(e) =>
                  upd((v) => ({
                    ...v,
                    extractedVars: v.extractedVars.map((x, i) => (i === evIdx ? { ...x, varName: e.target.value } : x)),
                  }))
                }
                placeholder="email"
                className="font-mono text-sm w-52"
              />
              <Input
                value={ev.description}
                onChange={(e) =>
                  upd((v) => ({
                    ...v,
                    extractedVars: v.extractedVars.map((x, i) => (i === evIdx ? { ...x, description: e.target.value } : x)),
                  }))
                }
                placeholder="Описание"
                className="min-w-0 flex-1"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => upd((v) => ({ ...v, extractedVars: v.extractedVars.filter((_, i) => i !== evIdx) }))}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        <Button variant="destructive" size="sm" onClick={() => setVariables((p) => p.filter((_, i) => i !== index))} className="gap-1.5">
          <Trash2 className="h-3.5 w-3.5" />
          Удалить переменную
        </Button>
      </CardContent>
    </Card>
  );
}
