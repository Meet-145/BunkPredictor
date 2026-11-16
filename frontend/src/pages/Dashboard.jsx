import {
  CalendarDays,
  ClipboardCheck,
  AlertTriangle,
  TrendingUp,
  ArrowRight,
} from "lucide-react";
import StatCard from "../components/StatCard.jsx";

export default function Dashboard({ setActivePage }) {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">
          Welcome back!
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Here's your attendance overview.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Overall Attendance"
          value="84.6%"
          subtitle="Sample data · Target: 80%"
          icon={TrendingUp}
          accent="violet"
        />
        <StatCard
          title="Lectures Today"
          value="5"
          subtitle="Based on sample timetable"
          icon={CalendarDays}
          accent="blue"
        />
        <StatCard
          title="Subjects at Risk"
          value="2"
          subtitle="Illustrative values"
          icon={AlertTriangle}
          accent="amber"
        />
        <StatCard
          title="Lectures Recorded"
          value="124"
          subtitle="Sample attendance records"
          icon={ClipboardCheck}
          accent="emerald"
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <section className="rounded-2xl border border-white/10 bg-[#12121D] p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-white">Today's Schedule</h2>
              <p className="mt-1 text-xs text-slate-500">
                Sample timetable
              </p>
            </div>

            <button
              onClick={() => setActivePage("timetable")}
              className="flex items-center gap-2 text-sm text-violet-300 hover:text-violet-200"
            >
              View timetable <ArrowRight size={16} />
            </button>
          </div>

          <div className="mt-6 space-y-3">
            {[
              { time: "10:10 AM", subject: "IoT & Automation", code: "IoTA" },
              { time: "12:10 PM", subject: "Machine Learning Essentials", code: "MLE" },
              { time: "3:10 PM", subject: "Distributed Computing", code: "DC" },
            ].map((lecture) => (
              <div
                key={lecture.code}
                className="flex items-center gap-4 rounded-xl border border-white/5 bg-white/[0.02] p-4"
              >
                <div className="h-10 w-1 rounded-full bg-violet-500" />

                <div className="flex-1">
                  <p className="text-sm font-medium text-white">
                    {lecture.subject}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {lecture.code}
                  </p>
                </div>

                <span className="text-xs text-slate-400">
                  {lecture.time}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-[#12121D] p-5">
          <h2 className="font-semibold text-white">Quick Actions</h2>
          <p className="mt-1 text-xs text-slate-500">
            Jump directly to a task.
          </p>

          <div className="mt-6 space-y-3">
            {[
              {
                title: "Manage timetable",
                description: "Upload, edit or view your schedule",
                page: "timetable",
                icon: CalendarDays,
              },
              {
                title: "Record attendance",
                description: "Update your lecture records",
                page: "attendance",
                icon: ClipboardCheck,
              },
              {
                title: "Explore predictions",
                description: "Compare attendance scenarios",
                page: "predictions",
                icon: TrendingUp,
              },
            ].map((action) => {
              const Icon = action.icon;

              return (
                <button
                  key={action.page}
                  onClick={() => setActivePage(action.page)}
                  className="flex w-full items-center gap-3 rounded-xl border border-white/10 p-4 text-left transition hover:border-violet-500/40 hover:bg-violet-500/5"
                >
                  <div className="rounded-lg bg-violet-500/10 p-2.5 text-violet-300">
                    <Icon size={19} />
                  </div>

                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">
                      {action.title}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {action.description}
                    </p>
                  </div>

                  <ArrowRight size={16} className="text-slate-500" />
                </button>
              );
            })}
          </div>
        </section>
      </div>

      <p className="text-xs text-slate-600">
        Dashboard figures are illustrative sample data, not actual attendance.
      </p>
    </div>
  );
}