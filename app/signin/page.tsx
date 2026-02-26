"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Sparkles, Mail, Lock, LogIn, UserPlus } from "lucide-react";

export default function SignIn() {
  const { signIn } = useAuthActions();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const router = useRouter();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-background via-background to-violet-950/20 px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-lg shadow-violet-500/30">
            <Sparkles className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            <span className="bg-gradient-to-r from-violet-600 via-fuchsia-600 to-violet-600 bg-clip-text text-transparent">
              Dr.Sarha AI Studio
            </span>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Войдите в систему для доступа к студии
          </p>
        </div>

        <form
          className="space-y-4 rounded-2xl border border-violet-200/50 bg-card/80 p-6 shadow-xl shadow-violet-500/5 backdrop-blur dark:border-violet-800/30"
          onSubmit={(e) => {
            e.preventDefault();
            setLoading(true);
            setError(null);
            const formData = new FormData(e.target as HTMLFormElement);
            formData.set("flow", isSignUp ? "signUp" : "signIn");
            void signIn("password", formData)
              .then(() => router.push("/"))
              .catch((err) => {
                setError(err.message);
                setLoading(false);
              });
          }}
        >
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium text-foreground">
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                id="email"
                name="email"
                type="email"
                placeholder="your@email.com"
                required
                className="w-full rounded-lg border border-input bg-background py-3 pl-10 pr-4 text-foreground placeholder:text-muted-foreground focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 focus:outline-none"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium text-foreground">
              Пароль
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                required
                className="w-full rounded-lg border border-input bg-background py-3 pl-10 pr-4 text-foreground placeholder:text-muted-foreground focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setIsSignUp(false)}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                !isSignUp ? "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              Вход
            </button>
            <button
              type="button"
              onClick={() => setIsSignUp(true)}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isSignUp ? "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              Регистрация
            </button>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 py-3 font-semibold text-white shadow-lg shadow-violet-500/25 transition-all hover:from-violet-700 hover:to-fuchsia-700 hover:shadow-violet-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : isSignUp ? (
              <UserPlus className="h-4 w-4" />
            ) : (
              <LogIn className="h-4 w-4" />
            )}
            {loading ? (isSignUp ? "Регистрация..." : "Вход...") : isSignUp ? "Зарегистрироваться" : "Войти"}
          </button>

          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3">
              <p className="text-sm font-medium text-destructive">{error}</p>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
