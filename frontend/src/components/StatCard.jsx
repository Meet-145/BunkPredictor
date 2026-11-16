export default function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  accent = "violet",
}) {
  const accentStyles = {
    violet: "bg-violet-500/10 text-violet-300",
    blue: "bg-blue-500/10 text-blue-300",
    emerald: "bg-emerald-500/10 text-emerald-300",
    amber: "bg-amber-500/10 text-amber-300",
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-[#12121D] p-5 transition hover:border-violet-500/30">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-slate-400">{title}</p>
          <h3 className="mt-3 text-3xl font-bold tracking-tight text-white">
            {value}
          </h3>
        </div>

        <div
          className={`rounded-xl p-3 ${
            accentStyles[accent] ?? accentStyles.violet
          }`}
        >
          {Icon && <Icon size={21} />}
        </div>
      </div>

      <p className="mt-4 text-xs text-slate-500">{subtitle}</p>
    </div>
  );
}