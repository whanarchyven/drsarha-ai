"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useConvexAuth } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Cpu, Zap, PlayCircle, LogOut, Sparkles, Users } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

const baseLinks = [
  { href: "/models", label: "Модели", icon: Cpu },
  { href: "/methods", label: "Методы", icon: Zap },
  { href: "/test", label: "Тест запуска", icon: PlayCircle },
];

export default function StudioSidebar() {
  const pathname = usePathname();
  const { isAuthenticated } = useConvexAuth();
  const { signOut } = useAuthActions();
  const router = useRouter();
  const role = useQuery(api.users.getMyRole);
  const isAdmin = role === "admin";
  const links = [
    ...baseLinks,
    ...(isAdmin ? [{ href: "/users", label: "Пользователи", icon: Users }] : []),
  ];

  return (
    <aside className="w-full border-r border-primary/10 bg-gradient-to-b from-card to-card/60 backdrop-blur md:w-64">
      <div className="p-4">
        <h1 className="flex items-center gap-2 text-lg font-semibold">
          <Sparkles className="h-5 w-5 text-violet-500" />
          <span className="bg-gradient-to-r from-violet-500 via-fuchsia-500 to-sky-500 bg-clip-text text-transparent">
            AI Studio
          </span>
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">Управление моделями и методами</p>
      </div>
      <nav className="space-y-1 px-2 pb-4">
        {links.map((link) => {
          const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                active
                  ? "bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-md shadow-violet-500/25"
                  : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
              )}
            >
              <Icon className={cn("h-4 w-4 shrink-0", active && "text-white")} />
              {link.label}
            </Link>
          );
        })}
      </nav>
      {isAuthenticated && (
        <div className="border-t border-border/50 p-4">
          <Button
            variant="outline"
            className="w-full gap-2 border-violet-200/60 hover:bg-violet-50 hover:border-violet-300 dark:border-violet-900/40 dark:hover:bg-violet-950/30"
            onClick={() =>
              void signOut().then(() => {
                router.push("/signin");
              })
            }
          >
            <LogOut className="h-4 w-4" />
            Выйти
          </Button>
        </div>
      )}
    </aside>
  );
}
