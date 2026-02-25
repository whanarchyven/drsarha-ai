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
import { toast } from "sonner";
import { Cpu, Save, ArrowLeft } from "lucide-react";

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
  const [code, setCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (model) {
      setName(model.name);
      setCode(model.code ?? "");
    }
  }, [model]);

  const onSave = async () => {
    if (!name.trim() || !code.trim()) {
      setError("Нужно заполнить name и model code");
      toast.error("Нужно заполнить name и model code");
      return;
    }
    setError("");
    setSaving(true);
    try {
      if (modelId) {
        await updateModel({ id: modelId, name: name.trim(), code: code.trim() });
        toast.success("Модель обновлена");
      } else {
        await createModel({ name: name.trim(), code: code.trim() });
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

  return (
    <div className="space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Cpu className="h-7 w-7 text-violet-500" />
          <span className="page-header-gradient">{modelId ? "Редактирование модели" : "Создание модели"}</span>
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Используйте OpenAI model code, например gpt-5.2</p>
      </header>
    <Card className="card-gradient-border shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Cpu className="h-5 w-5 text-violet-500" />
          Параметры модели
        </CardTitle>
        <CardDescription>Используйте OpenAI model code, например `gpt-5.2`.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="model-name">Name</Label>
          <Input id="model-name" value={name} onChange={(event) => setName(event.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="model-code">Model code</Label>
          <Input
            id="model-code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="gpt-5.2"
          />
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
