"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BedDouble,
  CalendarRange,
  ClipboardCheck,
  ExternalLink,
  GraduationCap,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  X,
  ChevronRight,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/admin/dashboard",     label: "Tổng quan",          icon: LayoutDashboard },
  { href: "/admin/rooms",         label: "Quản lý Phòng",      icon: BedDouble },
  { href: "/admin/registrations", label: "Xét duyệt Đơn",      icon: ClipboardCheck },
  { href: "/admin/waves",         label: "Đợt đăng ký",        icon: CalendarRange },
  { href: "/admin/settings",      label: "Cài đặt & Form",     icon: Settings },
  { href: "/admin/audit-logs",    label: "Nhật ký hoạt động",  icon: History },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname  = usePathname();
  const router    = useRouter();
  const [sidebarOpen, setSidebarOpen]     = useState(false);
  const [userEmail, setUserEmail]         = useState<string>("");
  const [sessionWarning, setSessionWarning] = useState(false);

  const isLoginPage = pathname === "/admin/login";

  useEffect(() => {
    if (isLoginPage) return;
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user?.email) setUserEmail(data.session.user.email);
      if (data.session?.expires_at) {
        const msLeft = data.session.expires_at * 1000 - Date.now();
        if (msLeft > 0 && msLeft < 5 * 60 * 1000) setSessionWarning(true);
      }
    });
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
    return () => { listener.subscription.unsubscribe(); clearInterval(interval); };
  }, [isLoginPage, router]);

  if (isLoginPage) return <>{children}</>;

  const handleLogout = async () => {
    await createClient().auth.signOut();
    router.push("/admin/login");
    router.refresh();
  };

  const currentNav = NAV_ITEMS.find(i => pathname.startsWith(i.href));
  const userInitial = userEmail ? userEmail.charAt(0).toUpperCase() : "A";

  return (
    <div className="min-h-screen flex bg-[#f4f4f4]">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── SIDEBAR ── Near-black with red accents */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 flex w-60 flex-col bg-[#0c0c0c] transition-transform duration-200 lg:static lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Logo */}
        <div className="flex items-center justify-between border-b border-white/8 px-4 py-4">
          <Link href="/admin/dashboard" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-600 text-white shadow-lg shadow-red-900/50">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[13px] font-black tracking-tight text-white">KTX HANU</p>
              <p className="text-[10px] font-semibold text-white/35 uppercase tracking-widest">Admin Panel</p>
            </div>
          </Link>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="rounded-lg p-1.5 text-white/40 hover:bg-white/8 hover:text-white lg:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-0.5 p-2.5 py-3">
          <p className="mb-2 px-2 text-[10px] font-bold uppercase tracking-widest text-white/25">Menu</p>
          {NAV_ITEMS.map(item => {
            const Icon  = item.icon;
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all",
                  active
                    ? "bg-red-600 text-white font-bold shadow-lg shadow-red-900/40"
                    : "text-white/50 hover:bg-white/6 hover:text-white font-medium"
                )}
              >
                <Icon className={cn("h-4 w-4 shrink-0", active ? "text-white" : "text-white/40 group-hover:text-white/80")} />
                <span className="flex-1">{item.label}</span>
                {active && <ChevronRight className="h-3.5 w-3.5 text-white/50" />}
              </Link>
            );
          })}
        </nav>

        {/* User + Logout */}
        <div className="border-t border-white/8 p-3 space-y-2">
          {userEmail && (
            <div className="flex items-center gap-2.5 rounded-xl bg-white/5 px-3 py-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-600 text-xs font-black text-white shadow-sm">
                {userInitial}
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-white/30">Quản trị viên</p>
                <p className="truncate text-xs font-semibold text-white/80" title={userEmail}>{userEmail}</p>
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-red-400 transition hover:bg-red-500/10 hover:text-red-300"
          >
            <LogOut className="h-4 w-4" />
            Đăng xuất
          </button>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-black/10 bg-white px-4 py-3 lg:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="rounded-xl border border-gray-200 p-2 text-gray-600 hover:bg-gray-50 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-1.5 text-sm">
              <span className="font-medium text-gray-400 hidden sm:inline">Admin</span>
              <ChevronRight className="h-3.5 w-3.5 text-gray-300 hidden sm:inline" />
              <span className="font-black text-black">{currentNav?.label ?? "Dashboard"}</span>
            </div>
          </div>
          <Link
            href="/"
            target="_blank"
            className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2 text-xs font-bold text-gray-700 transition hover:bg-gray-100 hover:text-black"
          >
            Cổng Sinh viên
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </header>

        {sessionWarning && (
          <div className="border-b border-amber-200 bg-amber-50 px-5 py-2 text-xs font-semibold text-amber-800">
            ⚠️ Phiên đăng nhập sắp hết hạn. Vui lòng lưu công việc đang thực hiện.
          </div>
        )}

        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
