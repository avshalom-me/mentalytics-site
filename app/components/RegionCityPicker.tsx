"use client";

import { useMemo, useState } from "react";
import { REGION_CITIES } from "@/app/lib/regions";
import { ChevronDown, X } from "lucide-react";

/**
 * Collapsible region → city picker.
 * - Shows regions as clickable accordion headers; cities appear only when a region is opened.
 * - Limits the number of selected cities to `maxCities` (default 3) for NEW selections,
 *   while leaving any pre-existing over-limit selections intact and removable
 *   (so therapists who registered earlier with more cities are not forced to lose them).
 */
export default function RegionCityPicker({
  selected,
  onChange,
  maxCities = 3,
  disabled = false,
}: {
  selected: string[];
  onChange: (v: string[]) => void;
  maxCities?: number;
  disabled?: boolean;
}) {
  const [openRegion, setOpenRegion] = useState<string | null>(null);
  const limitReached = selected.length >= maxCities;

  // Count selected cities per region for the header badges.
  const countByRegion = useMemo(() => {
    const map: Record<string, number> = {};
    for (const [region, cities] of Object.entries(REGION_CITIES)) {
      map[region] = cities.filter((c) => selected.includes(c)).length;
    }
    return map;
  }, [selected]);

  function toggleCity(city: string) {
    if (disabled) return;
    if (selected.includes(city)) {
      onChange(selected.filter((c) => c !== city));
    } else if (!limitReached) {
      onChange([...selected, city]);
    }
  }

  return (
    <div>
      {/* Summary + selected chips */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-stone-600">
          נבחרו {selected.length}/{maxCities} ערים
        </span>
        {selected.map((city) => (
          <button
            key={city}
            type="button"
            onClick={() => toggleCity(city)}
            disabled={disabled}
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold"
            style={{ background: "var(--teal-pale)", color: "var(--teal-dark)" }}
          >
            {city}
            <X size={12} />
          </button>
        ))}
      </div>

      {limitReached && (
        <p className="mb-3 text-xs text-stone-600">
          בחרת את מירב הערים האפשריות. כדי לבחור עיר אחרת — הסר/י אחת.
        </p>
      )}

      {/* Region accordion */}
      <div className="overflow-hidden rounded-xl border border-stone-200">
        {Object.entries(REGION_CITIES).map(([region, cities], idx) => {
          const isOpen = openRegion === region;
          const count = countByRegion[region] ?? 0;
          return (
            <div key={region} className={idx > 0 ? "border-t border-stone-200" : ""}>
              <button
                type="button"
                onClick={() => setOpenRegion(isOpen ? null : region)}
                className="flex w-full items-center justify-between px-4 py-3 text-right hover:bg-stone-50"
              >
                <span className="flex items-center gap-2 text-sm font-bold text-stone-800">
                  {region}
                  {count > 0 && (
                    <span
                      className="inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-black text-white"
                      style={{ background: "var(--teal)" }}
                    >
                      {count}
                    </span>
                  )}
                </span>
                <ChevronDown
                  size={18}
                  className="text-stone-400 transition-transform"
                  style={{ transform: isOpen ? "rotate(180deg)" : "none" }}
                />
              </button>

              {isOpen && (
                <div className="grid gap-1.5 px-4 pb-4 pt-1 sm:grid-cols-3">
                  {cities.map((city) => {
                    const checked = selected.includes(city);
                    const cityDisabled = disabled || (!checked && limitReached);
                    return (
                      <label
                        key={city}
                        className={`flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm ${
                          checked
                            ? "border-[var(--teal)] bg-[var(--teal-pale)] font-semibold text-[var(--teal-dark)]"
                            : "border-stone-200 hover:bg-stone-50"
                        } ${cityDisabled ? "cursor-not-allowed opacity-40" : ""}`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={cityDisabled}
                          onChange={() => toggleCity(city)}
                        />
                        <span>{city}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
