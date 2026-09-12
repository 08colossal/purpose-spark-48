import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { GraduationCap, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOutAndGoHome } from "@/lib/session";

type AppShellProps = {
  children: ReactNode;
  title: string;
  subtitle?: string;
  userName?: string;
  nav?: ReactNode;
  wide?: boolean;
};

export function AppShell({ children, title, subtitle, userName, nav, wide }: AppShellProps) {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border/70 bg-card/85 backdrop-blur">
        <div
          className={`mx-auto flex flex-wrap items-center gap-3 px-4 py-3 sm:px-6 ${wide ? "max-w-7xl" : "max-w-4xl"}`}
        >
          <Link to="/" className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <GraduationCap className="h-5 w-5" />
            </span>
            <span className="font-display text-sm font-semibold leading-tight">
              Trilha
              <span className="block text-xs font-normal text-muted-foreground">Hacktudo 2026</span>
            </span>
          </Link>
          <div className="ml-auto flex items-center gap-2">
            {nav}
            {userName ? (
              <span className="hidden text-sm text-muted-foreground sm:inline">{userName}</span>
            ) : null}
            <Button variant="ghost" size="sm" onClick={() => void signOutAndGoHome()}>
              <LogOut className="h-4 w-4" />
              <span className="sr-only sm:not-sr-only sm:ml-1">Sair</span>
            </Button>
          </div>
        </div>
      </header>

      <main className={`mx-auto px-4 py-6 sm:px-6 sm:py-8 ${wide ? "max-w-7xl" : "max-w-4xl"}`}>
        <div className="mb-6">
          <h1 className="text-2xl font-bold sm:text-3xl">{title}</h1>
          {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
        </div>
        {children}
      </main>
    </div>
  );
}
