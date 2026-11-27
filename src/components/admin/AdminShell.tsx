"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BedDouble,
  Building2,
  CalendarRange,
  ClipboardCheck,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/admin/dashboard", label: "Tổng quan", icon: LayoutDashboard },
  { href: "/admin/rooms", label: "Quản lý Phòng", icon: BedDouble },
  { href: "/admin/registrations", label: "Xét duyệt Đơn", icon: ClipboardCheck },
  { href: "/admin/waves", label: "Đợt đăng ký", icon: CalendarRange },
  { href: "/admin/settings", label: "Cài đặt & Form", icon: Settings },
  { href: "/admin/audit-logs", label: "Nhật ký hoạt động", icon: History },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string>("");
  const [sessionWarning, setSessionWarning] = useState(false);

  // Skip shell on login page
  const isLoginPage = pathname === "/admin/login";

  useEffect(() => {
    if (isLoginPage) return;
    const supabase = createClient();

    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user?.email) {
        setUserEmail(data.session.user.email);
      }
      if (data.session?.expires_at) {
        const msLeft = data.session.expires_at * 1000 - Date.now();
        if (msLeft > 0 && msLeft < 5 * 60 * 1000) {
          setSessionWarning(true);
        }
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || !session) {
        router.push("/admin/login");
      } else if (event === "TOKEN_REFRESHED") {
        setSessionWarning(false);
      }
    });

    // Periodic check every 60s to auto-refresh token before expiry
    const intervalId = setInterval(async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session?.expires_at) {
        const msLeft = data.session.expires_at * 1000 - Date.now();
        if (msLeft < 10 * 60 * 1000) {
          const { error } = await supabase.auth.refreshSession();
          if (error) setSessionWarning(true);
        }
      }
    }, 60000);

    return () => {
      listener.subscription.unsubscribe();
      clearInterval(intervalId);
    };
  }, [isLoginPage, router]);

  if (isLoginPage) {
    return <>{children}</>;
  }

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform lg:static lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4">
          <Link href="/admin/rooms" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">Admin KTX HANU</p>
              <p className="text-[11px] text-slate-500">Quản lý nội trú</p>
            </div>
          </Link>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="rounded-lg p-1 text-slate-500 lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1.5 p-3">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition",
                  active
                    ? "bg-blue-600 text-white font-semibold shadow-sm"
                    : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-slate-200 p-3.5 space-y-2">
          {userEmail && (
            <p className="truncate px-2 text-xs font-medium text-slate-600" title={userEmail}>
              {userEmail}
            </p>
          )}
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50"
          >
            <LogOut className="h-4 w-4" />
            Đăng xuất
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex flex-1 flex-col min-w-0">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3.5 lg:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="rounded-lg border border-slate-200 p-2 text-slate-700 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <span className="text-sm font-bold text-slate-800 sm:text-base">
              {NAV_ITEMS.find((i) => pathname.startsWith(i.href))?.label ??
                "Hệ thống Quản trị Ký túc xá"}
            </span>
          </div>

          <Link
            href="/"
            target="_blank"
            className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 sm:text-sm"
          >
            Xem Cổng Sinh viên ↗
          </Link>
        </header>

        {sessionWarning && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-xs font-medium text-amber-800">
            Phiên đăng nhập sắp hết hạn. Vui lòng lưu công việc đang thực hiện.
          </div>
        )}

        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
