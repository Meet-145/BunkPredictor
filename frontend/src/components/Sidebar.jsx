import {
  LayoutDashboard,
  CalendarDays,
  ClipboardCheck,
  BrainCircuit,
  GraduationCap,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";

export default function Sidebar({
  activePage,
  setActivePage,
  collapsed,
  setCollapsed,
}) {
  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "timetable", label: "Timetable Management", icon: CalendarDays },
    { id: "attendance", label: "Attendance Tracker", icon: ClipboardCheck },
    { id: "predictions", label: "Prediction Center", icon: BrainCircuit },
  ];

  return (
    <aside
      className={`flex h-screen flex-col border-r border-white/10 bg-[#0D0D16] transition-all duration-300 ${
        collapsed ? "w-[76px]" : "w-[260px]"
      }`}
    >
      <div className="flex h-[76px] items-center justify-between border-b border-white/10 px-5">
        {!collapsed && (
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-violet-600 p-2">
              <GraduationCap size={22} />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white">
                BunkPredictor
              </h1>
              <p className="text-xs text-slate-500">Smart attendance</p>
            </div>
          </div>
        )}

        {collapsed && (
          <div className="mx-auto rounded-xl bg-violet-600 p-2">
            <GraduationCap size={22} />
          </div>
        )}
      </div>

      <div className="flex-1 space-y-2 px-3 py-6">
        {!collapsed && (
          <p className="mb-4 px-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Workspace
          </p>
        )}

        {menuItems.map((item) => {
          const Icon = item.icon;
          const active = activePage === item.id;

          return (
            <button
              key={item.id}
              onClick={() => setActivePage(item.id)}
              title={collapsed ? item.label : undefined}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm transition ${
                active
                  ? "bg-violet-600/15 text-violet-300 ring-1 ring-violet-500/20"
                  : "text-slate-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              <Icon size={20} />
              {!collapsed && (
                <span className="text-left">{item.label}</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="border-t border-white/10 p-3">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex w-full items-center justify-center gap-3 rounded-xl px-3 py-3 text-sm text-slate-400 hover:bg-white/5 hover:text-white"
        >
          {collapsed ? (
            <PanelLeftOpen size={19} />
          ) : (
            <>
              <PanelLeftClose size={19} />
              <span>Collapse sidebar</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}