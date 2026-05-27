"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "@/app/providers";
import { motion } from "framer-motion";
import {
  BarChart3,
  UploadCloud,
  Users,
  FileSpreadsheet,
  Sun,
  Moon,
  LogOut,
  Building2,
  Menu,
  X,
  Handshake,
  ShieldAlert,
  ClipboardList,
  Clock,
  ScanSearch,
  ChevronRight
} from "lucide-react";

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  
  const [user, setUser] = useState<any>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedUser = localStorage.getItem("user");
      if (storedUser) {
        try {
          setUser(JSON.parse(storedUser));
        } catch (e) {
          // ignore
        }
      }
    }
  }, [pathname]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    router.push("/login");
  };

  const navItems = [
    { name: "Dashboard", href: "/dashboard", icon: BarChart3 },
    { name: "Today's Worklist", href: "/worklist", icon: ClipboardList },
    { name: "Collections Priority", href: "/collections", icon: Users },
    { name: "Ingest Invoices", href: "/upload", icon: UploadCloud },
    { name: "Review Queue", href: "/review", icon: ScanSearch },
    { name: "Promises to Pay", href: "/promises", icon: Handshake },
    { name: "Disputes", href: "/disputes", icon: ShieldAlert },
    { name: "Customer Timeline", href: "/timeline", icon: Clock },
    { name: "All Invoices", href: "/invoices", icon: FileSpreadsheet },
  ];

  const isActive = (path: string) => pathname === path;

  const SidebarContent = () => (
    <div className="flex h-full flex-col justify-between py-6 px-4">
      <div>
        <div className={`flex items-center mb-10 ${collapsed ? "justify-center" : "gap-3"}`}>
          <div className="flex shrink-0 h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-lg shadow-emerald-500/20">
            <Building2 size={22} />
          </div>
          {!collapsed && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="overflow-hidden">
              <span className="block text-base font-bold tracking-tight text-foreground leading-tight whitespace-nowrap">
                Collections Copilot
              </span>
              {user?.business_name && (
                <span className="block text-[10px] font-bold text-emerald-500 uppercase tracking-widest leading-none mt-1 truncate max-w-[150px]">
                  {user.business_name}
                </span>
              )}
            </motion.div>
          )}
        </div>

        <nav className="space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group flex items-center rounded-xl transition-all duration-200 ${
                  collapsed ? "justify-center p-3" : "px-3 py-2.5 gap-3"
                } ${
                  active
                    ? "bg-emerald-500/10 text-emerald-500 font-semibold"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground font-medium"
                }`}
                title={collapsed ? item.name : undefined}
              >
                <Icon size={18} className={active ? "text-emerald-500" : "text-muted-foreground group-hover:text-foreground"} />
                {!collapsed && <span className="truncate">{item.name}</span>}
                {!collapsed && active && (
                  <motion.div layoutId="activeNav" className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-500" />
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="space-y-3 pt-6 border-t border-border mt-auto">
        <button
          onClick={toggleTheme}
          className={`flex w-full items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors ${
            collapsed ? "justify-center p-3" : "px-3 py-2 gap-3"
          }`}
          title="Toggle Theme"
        >
          {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
          {!collapsed && <span>{theme === "light" ? "Dark Mode" : "Light Mode"}</span>}
        </button>

        <button
          onClick={() => setCollapsed(!collapsed)}
          className={`hidden md:flex w-full items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors ${
            collapsed ? "justify-center p-3" : "px-3 py-2 gap-3"
          }`}
        >
          <ChevronRight size={18} className={`transition-transform duration-300 ${collapsed ? "" : "rotate-180"}`} />
          {!collapsed && <span>Collapse Sidebar</span>}
        </button>

        <div className={`flex items-center rounded-xl bg-card border border-border p-3 ${collapsed ? "justify-center" : "gap-3"}`}>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 font-bold text-sm">
            {user?.full_name?.charAt(0) || "U"}
          </div>
          {!collapsed && (
            <div className="flex-1 overflow-hidden">
              <p className="text-xs font-bold text-foreground truncate">{user?.full_name}</p>
              <p className="text-[10px] text-muted-foreground truncate">{user?.email}</p>
            </div>
          )}
          {!collapsed && (
            <button
              onClick={handleLogout}
              className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors ml-auto shrink-0"
              title="Log Out"
            >
              <LogOut size={16} />
            </button>
          )}
        </div>
        
        {collapsed && (
          <button
            onClick={handleLogout}
            className="flex w-full justify-center p-3 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl transition-colors"
            title="Log Out"
          >
            <LogOut size={18} />
          </button>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Header / Hamburger */}
      <div className="md:hidden flex items-center justify-between p-4 border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-lg">
            <Building2 size={16} />
          </div>
          <span className="text-sm font-bold tracking-tight">Copilot</span>
        </div>
        <button onClick={() => setMobileOpen(!mobileOpen)} className="p-2 text-foreground bg-muted rounded-lg">
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <motion.div 
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", bounce: 0, duration: 0.3 }}
            className="relative w-[280px] max-w-[80%] h-full bg-background border-r border-border shadow-2xl z-50"
          >
            <SidebarContent />
          </motion.div>
        </div>
      )}

      {/* Desktop Sidebar */}
      <motion.aside
        animate={{ width: collapsed ? 80 : 280 }}
        transition={{ type: "spring", bounce: 0, duration: 0.3 }}
        className="hidden md:flex h-screen sticky top-0 flex-col border-r border-border bg-background/50 backdrop-blur-xl z-30 shrink-0"
      >
        <SidebarContent />
      </motion.aside>
    </>
  );
}
