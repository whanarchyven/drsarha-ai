"use client";

import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Zap, Plus, Pencil, PlayCircle, Trash2, ArrowRightToLine, Variable, Braces, FileText, Globe } from "lucide-react";

export default function MethodsPage() {
  const methods = useQuery(api.methods.list) ?? [];
  const removeMethod = useMutation(api.methods.remove);

  const onDelete = async (id: (typeof methods)[number]["_id"]) => {
    try {
      await removeMethod({ id });
      toast.success("Метод удалён");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ошибка удаления метода");
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Zap className="h-7 w-7 text-amber-500" />
            <span className="page-header-gradient">Методы</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Список всех AI-методов и быстрые действия</p>
        </div>
        <Button asChild className="gap-2 bg-gradient-to-r from-amber-500 to-orange-500 shadow-lg shadow-amber-500/25 hover:from-amber-600 hover:to-orange-600">
          <Link href="/methods/new">
            <Plus className="h-4 w-4" />
            Новый метод
          </Link>
        </Button>
      </header>

      <div className="grid gap-4">
        {methods.map((method) => (
          <Card key={method._id} className="card-gradient-border overflow-hidden shadow-md transition-shadow hover:shadow-lg">
            <CardContent className="space-y-4 p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20">
                    <Zap className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <p className="font-semibold">{method.name}</p>
                    <Badge variant="secondary" className="mt-1 font-mono text-xs">{method.outputFormat}</Badge>
                  </div>
                </div>
              </div>

              {(method.inputs.length > 0 || method.variables.length > 0) && (
                <div className="flex flex-col gap-3 rounded-lg border border-border/60 bg-muted/20 p-3 pl-[52px] sm:pl-4">
                  {method.inputs.length > 0 && (
                    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
                      <span className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <ArrowRightToLine className="h-3.5 w-3.5" />
                        Входные параметры
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {method.inputs.map((input) => (
                          <Badge
                            key={input}
                            variant="outline"
                            className="gap-1 border-violet-200/70 bg-violet-50/80 font-mono text-xs dark:border-violet-800/50 dark:bg-violet-950/30"
                          >
                            <Variable className="h-3 w-3 shrink-0" />
                            {input}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {method.variables.length > 0 && (
                    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:gap-3">
                      <span className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <Braces className="h-3.5 w-3.5" />
                        Переменные
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {method.variables.map((v, i) => (
                          <Badge
                            key={`${v.name}-${i}`}
                            variant="outline"
                            className={v.type === "literal"
                              ? "gap-1.5 border-amber-200/70 bg-amber-50/80 font-mono text-xs dark:border-amber-800/50 dark:bg-amber-950/30"
                              : "gap-1.5 border-sky-200/70 bg-sky-50/80 font-mono text-xs dark:border-sky-800/50 dark:bg-sky-950/30"
                            }
                            title={v.type === "literal" ? "Константа" : "Функция HTTP"}
                          >
                            {v.type === "literal" ? (
                              <FileText className="h-3 w-3 shrink-0" />
                            ) : (
                              <Globe className="h-3 w-3 shrink-0" />
                            )}
                            <span>{v.name}</span>
                            <span className="text-[10px] opacity-80">
                              · {v.type === "literal" ? "константа" : "функция"}
                            </span>
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <p className="line-clamp-2 text-sm text-muted-foreground pl-[52px] sm:pl-0">{method.prompt}</p>
              <div className="flex flex-wrap gap-2 pl-[52px] sm:pl-0">
                <Button variant="outline" size="sm" asChild className="gap-1.5 border-violet-200/60 hover:bg-violet-50 dark:border-violet-800/50 dark:hover:bg-violet-950/30">
                  <Link href={`/methods/${method._id}/edit`}>
                    <Pencil className="h-3.5 w-3.5" />
                    Редактировать
                  </Link>
                </Button>
                <Button variant="outline" size="sm" asChild className="gap-1.5 border-emerald-200/60 hover:bg-emerald-50 dark:border-emerald-800/50 dark:hover:bg-emerald-950/30">
                  <Link href={`/test?method=${encodeURIComponent(method.name)}`}>
                    <PlayCircle className="h-3.5 w-3.5" />
                    Тест
                  </Link>
                </Button>
                <Button variant="destructive" size="sm" onClick={() => void onDelete(method._id)} className="gap-1.5">
                  <Trash2 className="h-3.5 w-3.5" />
                  Удалить
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {methods.length === 0 && (
          <div className="rounded-xl border border-dashed border-muted-foreground/25 bg-muted/20 py-12 text-center">
            <Zap className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <p className="mt-2 text-sm text-muted-foreground">Пока нет методов</p>
            <Button asChild variant="outline" size="sm" className="mt-3 gap-1.5">
              <Link href="/methods/new">
                <Plus className="h-4 w-4" />
                Создать первый метод
              </Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
