import { Bell, Search } from "lucide-react";

export default function Topbar({ activePage }) {
  const titles = {
    dashboard: ["Dashboard", "Your attendance at a glance"],
    timetable: ["Timetable Management", "Manage your weekly schedule"],
    attendance: ["Attendance Tracker", "Track your subject-wise attendance"],
    predictions: ["Prediction Center", "Explore attendance scenarios"],
  };

  const [title, subtitle] = titles[activePage] ?? titles.dashboard;

  return (
    <header className="flex min-h-[76px] items-center justify-between gap-4 border-b border-white/10 bg-[#0B0B13]/80 px-5 sm:px-8">
      <div>
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
      </div>

      <div className="flex items-center gap-3">
        <button
          aria-label="Search"
          title="Search"
          className="rounded-xl border border-white/10 p-2.5 text-slate-400 hover:bg-white/5 hover:text-white"
        >
          <Search size={18} />
        </button>

        <button
          aria-label="Notifications"
          title="Notifications"
          className="rounded-xl border border-white/10 p-2.5 text-slate-400 hover:bg-white/5 hover:text-white"
        >
          <Bell size={18} />
        </button>

        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-sm font-bold text-white">
          S
        </div>
      </div>
    </header>
  );
}