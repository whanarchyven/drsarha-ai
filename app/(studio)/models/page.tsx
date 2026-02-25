"use client";

import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Cpu, Plus, Pencil, Trash2 } from "lucide-react";

export default function ModelsPage() {
  const models = useQuery(api.models.list) ?? [];
  const removeModel = useMutation(api.models.remove);

  const onDelete = async (id: (typeof models)[number]["_id"]) => {
    try {
      await removeModel({ id });
      toast.success("Модель удалена");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ошибка удаления модели");
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Cpu className="h-7 w-7 text-violet-500" />
            <span className="page-header-gradient">Модели</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Список моделей OpenAI и их кодов</p>
        </div>
        <Button asChild className="gap-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 shadow-lg shadow-violet-500/25 hover:from-violet-700 hover:to-fuchsia-700">
          <Link href="/models/new">
            <Plus className="h-4 w-4" />
            Новая модель
          </Link>
        </Button>
      </header>

      <div className="grid gap-4">
        {models.map((model) => (
          <Card key={model._id} className="card-gradient-border overflow-hidden shadow-md transition-shadow hover:shadow-lg">
            <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20">
                  <Cpu className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                </div>
                <div>
                  <p className="font-semibold">{model.name}</p>
                  <p className="text-sm text-muted-foreground font-mono">{model.code ?? "code не указан"}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="gap-1 font-mono">model</Badge>
                <Button variant="outline" size="sm" asChild className="gap-1.5 border-violet-200/60 hover:bg-violet-50 dark:border-violet-800/50 dark:hover:bg-violet-950/30">
                  <Link href={`/models/${model._id}/edit`}>
                    <Pencil className="h-3.5 w-3.5" />
                    Редактировать
                  </Link>
                </Button>
                <Button variant="destructive" size="sm" onClick={() => void onDelete(model._id)} className="gap-1.5">
                  <Trash2 className="h-3.5 w-3.5" />
                  Удалить
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {models.length === 0 && (
          <div className="rounded-xl border border-dashed border-muted-foreground/25 bg-muted/20 py-12 text-center">
            <Cpu className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <p className="mt-2 text-sm text-muted-foreground">Пока нет моделей</p>
            <Button asChild variant="outline" size="sm" className="mt-3 gap-1.5">
              <Link href="/models/new">
                <Plus className="h-4 w-4" />
                Создать первую модель
              </Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
