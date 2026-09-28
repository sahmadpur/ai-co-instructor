"use client";

import { useMemo } from "react";
import { PROVIDER_LABELS, getProvider, type Provider } from "@/lib/anthropic/cost";
import { useModels, type ClientModelOption } from "@/lib/use-models";

const SELECT_CLASS =
  "font-mono-num text-sm flex h-9 w-full rounded-md border border-input bg-paper/60 px-3 py-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50";

function formatPrice(m: ClientModelOption): string {
  if (m.input == null || m.output == null) return "price n/a";
  return `$${m.input}/$${m.output}`;
}

export function ModelSelect({
  id,
  value,
  onChange,
  disabled,
}: {
  id: string;
  value: string;
  onChange: (model: string) => void;
  disabled?: boolean;
}) {
  const { catalogue, loading } = useModels();

  // Keep the current value selectable even if the live catalogue no longer
  // lists it (e.g. a row generated with a since-retired model).
  const groups = useMemo(() => {
    const byProvider: Record<Provider, ClientModelOption[]> = {
      anthropic: [],
      openai: [],
    };
    for (const m of catalogue.models) byProvider[m.provider].push(m);
    if (value && !catalogue.models.some((m) => m.id === value)) {
      byProvider[getProvider(value)].push({
        id: value,
        provider: getProvider(value),
        label: `${value} (unlisted)`,
      });
    }
    return byProvider;
  }, [catalogue, value]);

  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      aria-busy={loading}
      className={SELECT_CLASS}
    >
      {(Object.keys(groups) as Provider[]).map((p) =>
        groups[p].length === 0 ? null : (
          <optgroup key={p} label={PROVIDER_LABELS[p]}>
            {groups[p].map((m) => (
              <option key={m.id} value={m.id}>
                {m.label === m.id ? m.id : `${m.label} · ${m.id}`} · {formatPrice(m)}
              </option>
            ))}
          </optgroup>
        ),
      )}
    </select>
  );
}
