"use client";

import { useEffect, useMemo, useState } from "react";
import { UtensilsCrossed, Plus, Check, Trash2, Wallet, Info } from "lucide-react";
import {
  DAYS,
  PERIODS,
  formatEgp,
  itemById,
  menuFor,
  type DayName,
} from "@/data/cafeteria";

const STORAGE_KEY = "ejust-cafeteria-v1";

type Trays = Partial<Record<DayName, string[]>>;

export default function CafeteriaPage() {
  const [trays, setTrays] = useState<Trays>({});
  const [budget, setBudget] = useState(120);
  const [day, setDay] = useState<DayName | null>(null);
  const [today, setToday] = useState<DayName | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setMounted(true);
      const todayName = DAYS[new Date().getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6];
      setToday(todayName);
      setDay(todayName);
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const saved = JSON.parse(raw) as { trays?: Trays; budget?: number };
          if (saved.trays) setTrays(saved.trays);
          if (typeof saved.budget === "number") setBudget(saved.budget);
        }
      } catch {
        // ignore corrupt storage
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ trays, budget }));
    } catch {
      // storage unavailable
    }
  }, [trays, budget, mounted]);

  const activeItems = useMemo(() => (day ? trays[day] ?? [] : []), [day, trays]);
  const trayItems = useMemo(
    () => activeItems.map(itemById).filter((i): i is NonNullable<typeof i> => Boolean(i)),
    [activeItems]
  );
  const trayTotal = trayItems.reduce((sum, item) => sum + item.price, 0);

  const weekCosts = useMemo(
    () =>
      DAYS.map((d) => ({
        day: d,
        items: (trays[d] ?? []).length,
        total: (trays[d] ?? []).reduce((sum, id) => sum + (itemById(id)?.price ?? 0), 0),
      })),
    [trays]
  );
  const weekTotal = weekCosts.reduce((sum, d) => sum + d.total, 0);
  const weekBudget = budget * 7;

  function toggle(id: string) {
    if (!day) return;
    setTrays((prev) => {
      const list = prev[day] ?? [];
      return {
        ...prev,
        [day]: list.includes(id) ? list.filter((x) => x !== id) : [...list, id],
      };
    });
  }

  function clearDay() {
    if (!day) return;
    setTrays((prev) => ({ ...prev, [day]: [] }));
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900">
            <UtensilsCrossed size={20} className="text-blue-600" />
            Cafeteria &amp; Meal Budget
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Build your daily tray, see the cost, and keep your weekly food spending on target.
          </p>
        </div>
        <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700">
          <Info size={12} />
          Sample menu &amp; prices — replace with the real cafeteria list
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-1 rounded-xl border border-gray-200 bg-white p-1.5">
        {DAYS.map((d) => (
          <button
            key={d}
            onClick={() => setDay(d)}
            className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
              d === day
                ? "bg-blue-600 text-white"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            {d.slice(0, 3)}
            {d === today && d === day ? " · today" : ""}
          </button>
        ))}
      </div>

      {!day ? (
        <p className="mt-6 text-sm text-gray-400">Loading menu…</p>
      ) : (
        <div className="mt-4 grid items-start gap-4 lg:grid-cols-[1fr_320px]">
          <div className="space-y-3">
            {PERIODS.map((period) => (
              <section key={period} className="rounded-xl border border-gray-200 bg-white">
                <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2">
                  <h2 className="text-sm font-semibold text-gray-900">{period}</h2>
                  <span className="text-[11px] text-gray-400">
                    {menuFor(day)[period].length} options
                  </span>
                </div>
                <ul className="divide-y divide-gray-50">
                  {menuFor(day)[period].map((item) => {
                    const picked = activeItems.includes(item.id);
                    return (
                      <li key={item.id} className="flex items-center gap-3 px-4 py-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-gray-900">{item.name}</p>
                          <div className="mt-0.5 flex flex-wrap gap-1">
                            {item.tags.map((tag) => (
                              <span
                                key={tag}
                                className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                                  tag === "Vegetarian"
                                    ? "bg-emerald-50 text-emerald-700"
                                    : "bg-gray-100 text-gray-500"
                                }`}
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                        <span className="shrink-0 text-sm font-semibold text-gray-800">
                          {formatEgp(item.price)}
                        </span>
                        <button
                          onClick={() => toggle(item.id)}
                          aria-label={`${picked ? "Remove" : "Add"} ${item.name}`}
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition ${
                            picked
                              ? "border-emerald-600 bg-emerald-600 text-white"
                              : "border-gray-300 text-gray-500 hover:border-blue-500 hover:text-blue-600"
                          }`}
                        >
                          {picked ? <Check size={14} /> : <Plus size={14} />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>

          <aside className="space-y-3 lg:sticky lg:top-16">
            <section className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-900">Your tray · {day}</h2>
                {trayItems.length > 0 && (
                  <button
                    onClick={clearDay}
                    className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-red-600"
                  >
                    <Trash2 size={11} />
                    Clear
                  </button>
                )}
              </div>
              {trayItems.length === 0 ? (
                <p className="mt-3 text-xs text-gray-400">
                  Nothing chosen yet. Tap + beside an item to add it.
                </p>
              ) : (
                <ul className="mt-2 space-y-1">
                  {trayItems.map((item) => (
                    <li key={item.id} className="flex justify-between gap-2 text-xs">
                      <span className="truncate text-gray-600">{item.name}</span>
                      <span className="shrink-0 font-medium text-gray-800">{item.price}</span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-3 flex items-baseline justify-between border-t border-gray-100 pt-3">
                <span className="text-xs text-gray-500">Tray total</span>
                <span className="text-lg font-bold text-gray-900">{formatEgp(trayTotal)}</span>
              </div>
              <div className="mt-2">
                <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className={`h-full rounded-full transition-all ${
                      trayTotal > budget ? "bg-red-500" : "bg-emerald-500"
                    }`}
                    style={{ width: `${Math.min(100, budget > 0 ? (trayTotal / budget) * 100 : 0)}%` }}
                  />
                </div>
                <p className={`mt-1 text-[11px] ${trayTotal > budget ? "text-red-600" : "text-gray-500"}`}>
                  {trayTotal > budget
                    ? `${formatEgp(trayTotal - budget)} over your daily budget`
                    : `${formatEgp(budget - trayTotal)} left of your daily budget`}
                </p>
              </div>
              <label className="mt-3 flex items-center gap-2 text-xs text-gray-500">
                <Wallet size={13} />
                Daily food budget
                <input
                  type="number"
                  min={20}
                  max={1000}
                  step={10}
                  value={budget}
                  onChange={(e) => setBudget(Math.max(20, Math.min(1000, Number(e.target.value) || 20)))}
                  className="ml-auto w-20 rounded-md border border-gray-200 px-2 py-1 text-right text-sm text-gray-800 outline-none focus:border-blue-400"
                />
              </label>
            </section>

            <section className="rounded-xl border border-gray-200 bg-white p-4">
              <h2 className="text-sm font-semibold text-gray-900">Week at a glance</h2>
              <p className="mt-1 text-[11px] text-gray-400">
                Days with a planned tray only — empty days count as 0.
              </p>
              <ul className="mt-2 space-y-1">
                {weekCosts.map(({ day: d, items, total }) => (
                  <li key={d} className="flex items-center justify-between text-xs">
                    <button
                      onClick={() => setDay(d)}
                      className={`${d === day ? "font-semibold text-blue-700" : "text-gray-600"} hover:text-blue-600`}
                    >
                      {d}
                    </button>
                    <span className="text-gray-400">{items} items</span>
                    <span className="w-20 text-right font-medium text-gray-800">
                      {total > 0 ? formatEgp(total) : "—"}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex items-baseline justify-between border-t border-gray-100 pt-3">
                <span className="text-xs text-gray-500">Planned week</span>
                <span className="text-base font-bold text-gray-900">{formatEgp(weekTotal)}</span>
              </div>
              <div className="mt-2">
                <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className={`h-full rounded-full transition-all ${
                      weekTotal > weekBudget ? "bg-red-500" : "bg-blue-500"
                    }`}
                    style={{ width: `${Math.min(100, weekBudget > 0 ? (weekTotal / weekBudget) * 100 : 0)}%` }}
                  />
                </div>
                <p className={`mt-1 text-[11px] ${weekTotal > weekBudget ? "text-red-600" : "text-gray-500"}`}>
                  {weekTotal > weekBudget
                    ? `${formatEgp(weekTotal - weekBudget)} over your weekly budget`
                    : `${formatEgp(weekBudget - weekTotal)} left of ${formatEgp(weekBudget)} weekly budget`}
                </p>
              </div>
            </section>
          </aside>
        </div>
      )}
    </main>
  );
}
