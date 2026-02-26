"use client";

import { useState, useEffect } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Users, UserPlus, Shield, ShieldCheck, Trash2 } from "lucide-react";

export default function UsersPage() {
  const router = useRouter();
  const role = useQuery(api.users.getMyRole);
  const users = useQuery(api.users.list) ?? [];
  const createUser = useAction(api.users.create);
  const setRole = useMutation(api.users.setRole);
  const removeUser = useMutation(api.users.remove);

  useEffect(() => {
    if (role !== undefined && role !== "admin") {
      router.replace("/methods");
    }
  }, [role, router]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [creating, setCreating] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      toast.error("Заполните email и пароль");
      return;
    }
    setCreating(true);
    try {
      await createUser({ email: email.trim(), password });
      toast.success("Пользователь создан");
      setEmail("");
      setPassword("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка создания");
    } finally {
      setCreating(false);
    }
  };

  const handleRoleChange = async (userId: Id<"users">, role: "admin" | "moderator" | null) => {
    try {
      await setRole({ userId, role });
      toast.success("Роль обновлена");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка");
    }
  };

  const handleRemove = async (userId: Id<"users">) => {
    if (!confirm("Удалить пользователя? Это действие нельзя отменить.")) return;
    try {
      await removeUser({ userId });
      toast.success("Пользователь удалён");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка");
    }
  };

  if (role !== undefined && role !== "admin") return null;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Users className="h-7 w-7 text-violet-500" />
          <span className="page-header-gradient">Пользователи</span>
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Регистрация пользователей и назначение ролей</p>
      </header>

      <Card className="card-gradient-border shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-violet-500" />
            Зарегистрировать пользователя
          </CardTitle>
          <CardDescription>Создайте нового пользователя с email и паролем</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com"
              />
            </div>
            <div className="flex-1 space-y-2">
              <Label htmlFor="password">Пароль</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Минимум 8 символов"
                minLength={8}
              />
            </div>
            <Button type="submit" disabled={creating} className="gap-2 shrink-0">
              {creating ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <UserPlus className="h-4 w-4" />
              )}
              Создать
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="card-gradient-border shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-amber-500" />
            Список пользователей
          </CardTitle>
          <CardDescription>Назначьте роли: admin — полный доступ, moderator — только редактор промпта</CardDescription>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <p className="text-sm text-muted-foreground">Нет пользователей или нет прав для просмотра</p>
          ) : (
            <div className="space-y-3">
              {users.map((user) => (
                <div
                  key={user._id}
                  className="flex flex-col gap-2 rounded-lg border bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium">{user.email ?? user.name ?? "—"}</p>
                    {user.name && user.email && <p className="text-xs text-muted-foreground">{user.email}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Select
                      value={user.role ?? "none"}
                      onValueChange={(v) => handleRoleChange(user._id, v === "none" ? null : (v as "admin" | "moderator"))}
                    >
                      <SelectTrigger className="w-36">
                        <SelectValue placeholder="Роль" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Без роли</SelectItem>
                        <SelectItem value="admin">
                          <span className="flex items-center gap-1.5">
                            <ShieldCheck className="h-3.5 w-3.5" />
                            admin
                          </span>
                        </SelectItem>
                        <SelectItem value="moderator">moderator</SelectItem>
                      </SelectContent>
                    </Select>
                    {!user.isCurrentUser && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleRemove(user._id)}
                        className="gap-1.5 shrink-0"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Удалить
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
