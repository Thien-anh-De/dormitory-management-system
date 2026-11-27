"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BedDouble,
  CalendarRange,
  ChevronRight,
  ClipboardCheck,
  ExternalLink,
  GraduationCap,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const NAV_GROUPS = [
  {
    title: "Vận hành KTX",
    items: [
      { href: "/admin/dashboard", label: "Tổng quan", icon: LayoutDashboard },
      { href: "/admin/rooms", label: "Quản lý Phòng", icon: BedDouble },
      { href: "/admin/registrations", label: "Xét duyệt Đơn", icon: ClipboardCheck, showPending: true },
      { href: "/admin/waves", label: "Đợt đăng ký", icon: CalendarRange },
    ],
  },
  {
    title: "Hệ thống",
    items: [
      { href: "/admin/settings", label: "Cài đặt & Form", icon: Settings },
      { href: "/admin/audit-logs", label: "Nhật ký hoạt động", icon: History },
    ],
  },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string>("");
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [sessionWarning, setSessionWarning] = useState(false);

  const isLoginPage = pathname === "/admin/login";

  useEffect(() => {
    if (isLoginPage) return;
    let active = true;
    const supabase = createClient();

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (data.session?.user?.email) setUserEmail(data.session.user.email);
      if (data.session?.expires_at) {
        const msLeft = data.session.expires_at * 1000 - Date.now();
        if (msLeft > 0 && msLeft < 5 * 60 * 1000) setSessionWarning(true);
      }
    });

    fetch("/api/admin/dashboard")
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (active && typeof d?.kpi?.pendingCount === "number") {
          setPendingCount(d.kpi.pendingCount);
        }
      })
      .catch(() => {});

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || !session) router.push("/admin/login");
      else if (event === "TOKEN_REFRESHED") setSessionWarning(false);
    });

    const interval = setInterval(async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session?.expires_at && data.session.expires_at * 1000 - Date.now() < 10 * 60 * 1000) {
        const { error } = await supabase.auth.refreshSession();
        if (error) setSessionWarning(true);
      }
    }, 60000);

    return () => {
      active = false;
      listener.subscription.unsubscribe();
      clearInterval(interval);
    };
  }, [isLoginPage, pathname, router]);

  if (isLoginPage) return <>{children}</>;

  const handleLogout = async () => {
    await createClient().auth.signOut();
    router.push("/admin/login");
    router.refresh();
  };

  const allItems = NAV_GROUPS.flatMap(g => g.items);
  const currentNav = allItems.find(i => pathname.startsWith(i.href));
  const userInitial = userEmail ? userEmail.charAt(0).toUpperCase() : "A";

  return (
    <div className="min-h-screen flex bg-[#f6f5f2] text-[#111114]">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/65 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── OBSIDIAN SIDEBAR ── */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-72 shrink-0 flex-col bg-[#111114] text-white transition-transform duration-200 lg:static lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Brand */}
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-5">
          <Link href="/admin/dashboard" className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#c8102e] text-white shadow-lg shadow-red-900/50">
              <GraduationCap className="h-6 w-6" />
            </div>
            <div>
              <p className="text-lg font-extrabold tracking-tight text-white leading-tight">KTX HANU</p>
              <p className="text-xs font-semibold uppercase tracking-wider text-white/45">Quản trị Nội trú</p>
            </div>
          </Link>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="rounded-xl p-2 text-white/50 hover:bg-white/10 hover:text-white lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Grouped Navigation */}
        <nav className="flex-1 space-y-6 overflow-y-auto px-3.5 py-5">
          {NAV_GROUPS.map(group => (
            <div key={group.title} className="space-y-1.5">
              <p className="px-3 text-xs font-extrabold uppercase tracking-wider text-white/35">
                {group.title}
              </p>
              {group.items.map(item => {
                const Icon = item.icon;
                const active = pathname.startsWith(item.href);
                const showBadge = "showPending" in item && item.showPending && pendingCount > 0;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={cn(
                      "group flex items-center gap-3 rounded-2xl px-3.5 py-3 text-[15px] transition-all",
                      active
                        ? "bg-[#c8102e] text-white font-extrabold shadow-lg shadow-red-950/50"
                        : "text-white/65 hover:bg-white/8 hover:text-white font-semibold"
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-5 w-5 shrink-0",
                        active ? "text-white" : "text-white/45 group-hover:text-white"
                      )}
                    />
                    <span className="flex-1">{item.label}</span>
                    {showBadge && (
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-0.5 font-mono text-xs font-extrabold tabular-nums",
                          active ? "bg-white text-[#c8102e]" : "bg-[#c8102e] text-white"
                        )}
                      >
                        {pendingCount}
                      </span>
                    )}
                    {active && !showBadge && <ChevronRight className="h-4 w-4 text-white/70" />}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* User Profile + Logout */}
        <div className="border-t border-white/10 p-4 space-y-2.5">
          {userEmail && (
            <div className="flex items-center gap-3 rounded-2xl bg-white/6 px-3.5 py-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#c8102e] text-sm font-extrabold text-white">
                {userInitial}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wider text-white/45">Quản trị viên</p>
                <p className="truncate text-sm font-semibold text-white/90" title={userEmail}>
                  {userEmail}
                </p>
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-2.5 rounded-2xl px-3.5 py-2.5 text-[15px] font-bold text-red-400 transition hover:bg-red-500/15 hover:text-red-300"
          >
            <LogOut className="h-4 w-4" />
            Đăng xuất tài khoản
          </button>
        </div>
      </aside>

      {/* ── MAIN WORKSPACE ── */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar */}
        <header className="sticky top-0 z-30 glass-bar flex min-h-[68px] items-center justify-between gap-4 px-4 py-3 lg:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="rounded-xl border border-black/10 bg-white p-2.5 text-[#111114] hover:bg-stone-100 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2 text-[15px]">
              <span className="hidden font-semibold text-stone-400 sm:inline">HANU Admin</span>
              <ChevronRight className="hidden h-4 w-4 text-stone-300 sm:inline" />
              <span className="font-extrabold text-[#111114]">{currentNav?.label ?? "Tổng quan"}</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {pendingCount > 0 && (
              <Link
                href="/admin/registrations"
                className="hidden sm:inline-flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-3.5 py-2 text-sm font-extrabold text-[#c8102e] hover:bg-red-100 transition"
              >
                <span className="h-2 w-2 rounded-full bg-[#c8102e] animate-pulse" />
                {pendingCount} đơn chờ duyệt
              </Link>
            )}
            <Link
              href="/"
              target="_blank"
              className="inline-flex items-center gap-2 rounded-xl bg-[#111114] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#c8102e]"
            >
              <span>Cổng Sinh viên</span>
              <ExternalLink className="h-4 w-4" />
            </Link>
          </div>
        </header>

        {sessionWarning && (
          <div className="border-b border-amber-200 bg-amber-50 px-6 py-2.5 text-sm font-bold text-amber-800">
            ⚠️ Phiên đăng nhập sắp hết hạn. Vui lòng lưu công việc đang thực hiện.
          </div>
        )}

        <main className="mx-auto w-full max-w-[1440px] flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
