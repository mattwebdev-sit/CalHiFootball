"use client";

import { useRouter } from "next/navigation";

export interface FilterOption {
  label: string;
  /** Destination href navigated to when this option is chosen. */
  value: string;
}

/**
 * Mobile-only filter control: a native <select> that navigates to the chosen
 * option's href. Hidden on >=sm, where the equivalent chip row is shown instead.
 * `value` must exactly match one option's `value` for the correct item to show.
 */
export function FilterSelect({
  label,
  value,
  options,
}: {
  label: string;
  value: string;
  options: FilterOption[];
}) {
  const router = useRouter();
  return (
    <label className="flex w-full flex-col gap-1 sm:hidden">
      <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => router.push(e.target.value)}
        className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 focus:border-emerald-500 focus:outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
