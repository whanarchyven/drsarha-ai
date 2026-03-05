"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Cpu, Save, ArrowLeft, Type, Image } from "lucide-react";
import { TEXT_MODELS, IMAGE_MODELS } from "@/lib/openai-models";

type ModelType = "text" | "image";

export default function ModelForm({
  modelId,
}: {
  modelId?: Id<"models">;
}) {
  const router = useRouter();
  const createModel = useMutation(api.models.create);
  const updateModel = useMutation(api.models.update);
  const model = useQuery(api.models.getById, modelId ? { id: modelId } : "skip");

  const [name, setName] = useState("");
  const [type, setType] = useState<ModelType>("text");
  const [code, setCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (model) {
      setName(model.name);
      setType((model.type as ModelType) ?? "text");
      setCode(model.code ?? "");
    }
  }, [model]);

  const modelOptions = type === "image" ? IMAGE_MODELS : TEXT_MODELS;
  const selectedInList = modelOptions.some((m) => m.code === code);
  const optionsWithCustom =
    code && !selectedInList
      ? [...modelOptions, { code, label: `${code} (текущая)` }]
      : modelOptions;

  const onSave = async () => {
    if (!name.trim()) {
      setError("Нужно заполнить name");
      toast.error("Нужно заполнить name");
      return;
    }
    if (!code.trim()) {
      setError("Нужно выбрать модель из списка");
      toast.error("Нужно выбрать модель из списка");
      return;
    }
    setError("");
    setSaving(true);
    try {
      if (modelId) {
        await updateModel({ id: modelId, name: name.trim(), type, code: code.trim() });
        toast.success("Модель обновлена");
      } else {
        await createModel({ name: name.trim(), type, code: code.trim() });
        toast.success("Модель создана");
      }
      router.push("/models");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка сохранения модели");
      toast.error(err instanceof Error ? err.message : "Ошибка сохранения модели");
    } finally {
      setSaving(false);
    }
  };

  const onTypeChange = (next: ModelType) => {
    setType(next);
    setCode("");
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Cpu className="h-7 w-7 text-violet-500" />
          <span className="page-header-gradient">{modelId ? "Редактирование модели" : "Создание модели"}</span>
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Выберите тип модели и код из списка OpenAI
        </p>
      </header>
      <Card className="card-gradient-border shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cpu className="h-5 w-5 text-violet-500" />
            Параметры модели
          </CardTitle>
          <CardDescription>
            Текстовая модель — для генерации текста (GPT). Изображение — для генерации картинок (DALL-E, GPT Image).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="model-name">Название</Label>
            <Input id="model-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Моя модель" />
          </div>

          <div className="space-y-2">
            <Label>Тип модели</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={type === "text" ? "default" : "outline"}
                onClick={() => onTypeChange("text")}
                className="gap-2"
              >
                <Type className="h-4 w-4" />
                Текстовая
              </Button>
              <Button
                type="button"
                variant={type === "image" ? "default" : "outline"}
                onClick={() => onTypeChange("image")}
                className="gap-2"
              >
                <Image className="h-4 w-4" />
                Изображение
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="model-code">Модель (код OpenAI)</Label>
            <Select value={code || ""} onValueChange={setCode}>
              <SelectTrigger id="model-code">
                <SelectValue placeholder={`Выберите ${type === "image" ? "модель изображений" : "текстовую модель"}`} />
              </SelectTrigger>
              <SelectContent>
                {optionsWithCustom.map((m) => (
                  <SelectItem key={m.code} value={m.code}>
                    {m.label} ({m.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {type === "text" ? "GPT-модели для чата и генерации текста" : "DALL-E и GPT Image для генерации изображений"}
            </p>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button
              onClick={() => void onSave()}
              disabled={saving}
              className="gap-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 shadow-lg shadow-violet-500/25 hover:from-violet-700 hover:to-fuchsia-700"
            >
              {saving ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {saving ? "Сохраняю..." : "Сохранить"}
            </Button>
            <Button variant="outline" onClick={() => router.push("/models")} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Отмена
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
