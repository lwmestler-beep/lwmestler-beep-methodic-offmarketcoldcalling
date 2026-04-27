"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, Upload, Copy, Settings, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/primitives";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/upload", label: "Upload", icon: Upload },
  { href: "/duplicates", label: "Duplicates", icon: Copy },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar({ displayName, email }: { displayName: string; email: string }) {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--background)]">
      <div className="px-5 py-5 border-b border-[var(--border)]">
        <div className="text-lg font-bold text-[var(--primary)]">Methodic</div>
        <div className="text-xs text-[var(--muted-foreground)]">Off-Market Tracker</div>
      </div>
      <nav className="flex-1 p-3 space-y-0.5">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== "/" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm",
                active
                  ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                  : "text-[var(--foreground)] hover:bg-[var(--muted)]",
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="p-3 border-t border-[var(--border)]">
        <div className="mb-2 px-2">
          <div className="text-sm font-medium">{displayName}</div>
          <div className="text-xs text-[var(--muted-foreground)] truncate">{email}</div>
        </div>
        <Button variant="ghost" size="sm" className="w-full justify-start" onClick={signOut}>
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </div>
    </aside>
  );
}

export function MobileNav({ displayName }: { displayName: string }) {
  const pathname = usePathname();
  return (
    <>
      <div className="md:hidden flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
        <div>
          <div className="text-base font-bold text-[var(--primary)]">Methodic</div>
        </div>
        <div className="text-xs text-[var(--muted-foreground)]">{displayName}</div>
      </div>
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 border-t border-[var(--border)] bg-[var(--background)] flex justify-around py-1.5">
        {navItems.slice(0, 5).map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== "/" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center gap-0.5 px-3 py-1.5 text-xs",
                active ? "text-[var(--primary)]" : "text-[var(--muted-foreground)]",
              )}
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
