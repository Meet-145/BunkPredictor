import { useState } from "react";

import Sidebar from "./components/Sidebar.jsx";
import Topbar from "./components/Topbar.jsx";

import Dashboard from "./pages/Dashboard.jsx";
import Timetable from "./pages/Timetable.jsx";
import Attendance from "./pages/Attendance.jsx";
import Predictions from "./pages/Predictions.jsx";

export default function App() {
  const [activePage, setActivePage] = useState("dashboard");
  const [collapsed, setCollapsed] = useState(false);

  const pages = {
    dashboard: (
      <Dashboard setActivePage={setActivePage} />
    ),
    timetable: <Timetable />,
    attendance: <Attendance setActivePage={setActivePage} />,
    predictions: <Predictions setActivePage={setActivePage} />,
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#09090F] text-slate-100">
      <div className="hidden shrink-0 md:block">
        <Sidebar
          activePage={activePage}
          setActivePage={setActivePage}
          collapsed={collapsed}
          setCollapsed={setCollapsed}
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar activePage={activePage} />

        <main className="flex-1 overflow-y-auto p-5 sm:p-8">
          <div className="mx-auto max-w-[1500px]">
            {pages[activePage]}
          </div>
        </main>

        <nav className="grid grid-cols-4 border-t border-white/10 bg-[#0D0D16] md:hidden">
          {[
            { id: "dashboard", label: "Home" },
            { id: "timetable", label: "Timetable" },
            { id: "attendance", label: "Attendance" },
            { id: "predictions", label: "Predict" },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActivePage(item.id)}
              className={`px-1 py-3 text-xs ${
                activePage === item.id
                  ? "text-violet-300"
                  : "text-slate-500"
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}