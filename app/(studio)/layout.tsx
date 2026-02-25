import type { ReactNode } from "react";
import StudioSidebar from "@/components/studio/sidebar";

export default function StudioLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/40 md:flex">
      <StudioSidebar />
      <section className="flex-1 p-4 md:p-8">{children}</section>
    </div>
  );
}
