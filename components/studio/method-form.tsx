"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
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
import { Zap, Save, ArrowLeft, Plus, Trash2 } from "lucide-react";
import PromptEditor from "./prompt-editor";
import { extractPromptTokens, isRecord, safeParseJson, prettyJson, tokenStyle } from "./utils";

type MethodDoc = Doc<"methods">;
type MethodVariable = MethodDoc["variables"][number];
type HttpVerb = "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "OPTIONS";

type VariableDraft = {
  id: string;
  type: "literal" | "function";
  name: string;
  valueText: string;
  url: string;
  method: HttpVerb;
  payloadText: string;
  headersText: string;
};

const HTTP_METHODS: Array<HttpVerb> = ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"];

function createDraftId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

function createDefaultVariableDraft(): VariableDraft {
  return {
    id: createDraftId(),
    type: "literal",
    name: "",
    valueText: "",
    url: "",
    method: "POST",
    payloadText: "{}",
    headersText: "{}",
  };
}

function toDraftVariables(variables: Array<MethodVariable>): Array<VariableDraft> {
  return variables.map((variable) => {
    if (variable.type === "literal") {
      return {
        id: createDraftId(),
        type: "literal",
        name: variable.name,
        valueText: typeof variable.value === "string" ? variable.value : prettyJson(variable.value),
        url: "",
        method: "POST",
        payloadText: "{}",
        headersText: "{}",
      };
    }
    return {
      id: createDraftId(),
      type: "function",
      name: variable.name,
      valueText: "",
      url: variable.url,
      method: variable.method.toUpperCase() as HttpVerb,
      payloadText: prettyJson(variable.payload),
      headersText: prettyJson(variable.headers),
    };
  });
}

function parseLiteralValue(valueText: string): unknown {
  if (!valueText.trim()) {
    return "";
  }
  const parsed = safeParseJson(valueText);
  if (parsed.ok) {
    return parsed.value;
  }
  return valueText;
}

function buildVariableFromDraft(draft: VariableDraft): { ok: true; value: MethodVariable } | { ok: false; error: string } {
  const name = draft.name.trim();
  if (!name) {
    return { ok: false, error: "Имя переменной обязательно" };
  }
  if (draft.type === "literal") {
    return {
      ok: true,
      value: { type: "literal", name, value: parseLiteralValue(draft.valueText) },
    };
  }
  if (!draft.url.trim()) {
    return { ok: false, error: `У переменной "${name}" не заполнен URL` };
  }
  const payloadParsed = safeParseJson(draft.payloadText || "{}");
  if (!payloadParsed.ok) {
    return { ok: false, error: `Некорректный payload в "${name}": ${payloadParsed.error}` };
  }
  const headersParsed = safeParseJson(draft.headersText || "{}");
  if (!headersParsed.ok) {
    return { ok: false, error: `Некорректный headers в "${name}": ${headersParsed.error}` };
  }
  if (!isRecord(headersParsed.value)) {
    return { ok: false, error: `Headers в "${name}" должны быть объектом` };
  }
  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(headersParsed.value)) {
    headers[key] = typeof value === "string" ? value : String(value);
  }
  return {
    ok: true,
    value: {
      type: "function",
      name,
      url: draft.url.trim(),
      method: draft.method,
      payload: payloadParsed.value,
      headers,
    },
  };
}

export default function MethodForm({
  methodId,
}: {
  methodId?: Id<"methods">;
}) {
  const router = useRouter();
  const models = useQuery(api.models.list) ?? [];
  const method = useQuery(api.methods.getById, methodId ? { id: methodId } : "skip");
  const createMethod = useMutation(api.methods.create);
  const updateMethod = useMutation(api.methods.update);

  const [name, setName] = useState("");
  const [modelId, setModelId] = useState("");
  const [inputs, setInputs] = useState("");
  const [outputFormat, setOutputFormat] = useState("JSON");
  const [settingsText, setSettingsText] = useState("{}");
  const [prompt, setPrompt] = useState("");
  const [variables, setVariables] = useState<Array<VariableDraft>>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!method) {
      return;
    }
    setName(method.name);
    setModelId(method.modelId);
    setInputs(method.inputs.join(", "));
    setOutputFormat(method.outputFormat);
    setSettingsText(method.settings === undefined ? "{}" : prettyJson(method.settings));
    setPrompt(method.prompt);
    setVariables(toDraftVariables(method.variables));
  }, [method]);

  const knownPromptVariables = useMemo(() => {
    const fromInputs = inputs
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    const fromVars = variables.map((item) => item.name.trim()).filter(Boolean);
    const fromPrompt = extractPromptTokens(prompt);
    return Array.from(new Set([...fromInputs, ...fromVars, ...fromPrompt]));
  }, [inputs, variables, prompt]);

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
    const inputNames = inputs
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    try {
      if (methodId) {
        await updateMethod({
          id: methodId,
          name: name.trim(),
          modelId: modelId as Id<"models">,
          prompt,
          outputFormat,
          inputs: inputNames,
          settings: parsedSettings.value,
          variables: builtVariables,
        });
        toast.success("Метод обновлён");
      } else {
        await createMethod({
          name: name.trim(),
          modelId: modelId as Id<"models">,
          prompt,
          outputFormat,
          inputs: inputNames,
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
            <Label>Method name</Label>
            <Input value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Model</Label>
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
            <Label>Inputs (через запятую)</Label>
            <Input value={inputs} onChange={(event) => setInputs(event.target.value)} placeholder="theme, age" />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Output format</Label>
            <Textarea value={outputFormat} onChange={(event) => setOutputFormat(event.target.value)} />
          </div>
        </div>

        <Separator />

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Variables</Label>
            <Button variant="outline" size="sm" onClick={() => setVariables((prev) => [...prev, createDefaultVariableDraft()])} className="gap-1.5">
              <Plus className="h-4 w-4" />
              Добавить
            </Button>
          </div>
          {variables.length === 0 && <p className="text-sm text-muted-foreground">Переменные пока не добавлены.</p>}
          <div className="space-y-3">
            {variables.map((variable, index) => (
              <Card key={variable.id} className="border border-dashed border-violet-200/60 bg-gradient-to-br from-card to-muted/20 dark:border-violet-800/40">
                <CardContent className="space-y-3 pt-5">
                  <div className="grid gap-3 md:grid-cols-4">
                    <div className="space-y-2 md:col-span-2">
                      <Label>Name</Label>
                      <Input
                        value={variable.name}
                        onChange={(event) =>
                          setVariables((prev) =>
                            prev.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, name: event.target.value } : item,
                            ),
                          )
                        }
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>Type</Label>
                      <Select
                        value={variable.type}
                        onValueChange={(next) =>
                          setVariables((prev) =>
                            prev.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, type: next as "literal" | "function" } : item,
                            ),
                          )
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="literal">literal</SelectItem>
                          <SelectItem value="function">function</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {variable.type === "literal" ? (
                    <div className="space-y-2">
                      <Label>Value (string или JSON)</Label>
                      <Textarea
                        value={variable.valueText}
                        onChange={(event) =>
                          setVariables((prev) =>
                            prev.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, valueText: event.target.value } : item,
                            ),
                          )
                        }
                      />
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="grid gap-3 md:grid-cols-3">
                        <div className="space-y-2 md:col-span-2">
                          <Label>Function URL</Label>
                          <Input
                            value={variable.url}
                            onChange={(event) =>
                              setVariables((prev) =>
                                prev.map((item, itemIndex) =>
                                  itemIndex === index ? { ...item, url: event.target.value } : item,
                                ),
                              )
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>HTTP method</Label>
                          <Select
                            value={variable.method}
                            onValueChange={(next) =>
                              setVariables((prev) =>
                                prev.map((item, itemIndex) =>
                                  itemIndex === index ? { ...item, method: next as HttpVerb } : item,
                                ),
                              )
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {HTTP_METHODS.map((httpMethod) => (
                                <SelectItem key={httpMethod} value={httpMethod}>
                                  {httpMethod}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Payload JSON</Label>
                          <Textarea
                            value={variable.payloadText}
                            onChange={(event) =>
                              setVariables((prev) =>
                                prev.map((item, itemIndex) =>
                                  itemIndex === index ? { ...item, payloadText: event.target.value } : item,
                                ),
                              )
                            }
                            className="font-mono text-xs"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Headers JSON</Label>
                          <Textarea
                            value={variable.headersText}
                            onChange={(event) =>
                              setVariables((prev) =>
                                prev.map((item, itemIndex) =>
                                  itemIndex === index ? { ...item, headersText: event.target.value } : item,
                                ),
                              )
                            }
                            className="font-mono text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setVariables((prev) => prev.filter((_, itemIndex) => itemIndex !== index))}
                    className="gap-1.5"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Удалить переменную
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <Separator />

        <div className="space-y-2">
          <Label>Доп. параметры OpenAI (опционально)</Label>
          <p className="text-xs text-muted-foreground">
            Можно оставить пустой объект <code>{"{}"}</code>. Поддерживается JSON/JSON5.
          </p>
          <Textarea
            value={settingsText}
            onChange={(event) => setSettingsText(event.target.value)}
            className="font-mono text-xs"
          />
        </div>

        <Separator />

        <div className="space-y-3">
          <Label>Prompt (подсветка {"{{variable}}"})</Label>
          <PromptEditor value={prompt} onChange={setPrompt} />
          <div className="flex flex-wrap gap-2">
            {knownPromptVariables.map((variableName) => {
              const style = tokenStyle(variableName);
              return (
                <Badge
                  key={variableName}
                  variant="outline"
                  style={{
                    backgroundColor: style.backgroundColor,
                    color: style.color,
                    borderColor: style.borderColor,
                  }}
                >
                  {variableName}
                </Badge>
              );
            })}
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex gap-2">
          <Button
            onClick={() => void onSave()}
            disabled={saving}
            className="gap-2 bg-gradient-to-r from-amber-500 to-orange-500 shadow-lg shadow-amber-500/25 hover:from-amber-600 hover:to-orange-600"
          >
            {saving ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <Save className="h-4 w-4" />
            )}
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
