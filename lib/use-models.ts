"use client";

import { useEffect, useState } from "react";
import {
  AVAILABLE_MODELS,
  DEFAULT_MODEL,
  getPricing,
  PRICING_PER_MTOK,
  type Provider,
} from "@/lib/anthropic/cost";

export interface ClientModelOption {
  id: string;
  provider: Provider;
  label: string;
  input?: number;
  output?: number;
}

export interface ClientCatalogue {
  models: ClientModelOption[];
  defaultModel: string;
  fallback: Provider[];
}

// Static table rendered on first paint so the select is never empty; replaced
// by the live catalogue from /api/models once it arrives. Shared across all
// mounted selects for the page lifetime.
const STATIC: ClientCatalogue = {
  models: AVAILABLE_MODELS.map((id) => {
    const p = getPricing(id);
    return {
      id,
      provider: PRICING_PER_MTOK[id].provider,
      label: p?.label ?? id,
      input: p?.input,
      output: p?.output,
    };
  }),
  defaultModel: DEFAULT_MODEL,
  fallback: [],
};

let shared: ClientCatalogue | null = null;
let sharedPromise: Promise<ClientCatalogue> | null = null;

function fetchCatalogue(): Promise<ClientCatalogue> {
  if (shared) return Promise.resolve(shared);
  if (sharedPromise) return sharedPromise;
  sharedPromise = fetch("/api/models")
    .then(async (res) => {
      if (!res.ok) throw new Error(`models request failed (${res.status})`);
      const data = (await res.json()) as ClientCatalogue;
      if (!Array.isArray(data.models) || data.models.length === 0) {
        throw new Error("empty model catalogue");
      }
      shared = data;
      return data;
    })
    .catch((err) => {
      console.warn("falling back to static model list", err);
      return STATIC;
    })
    .finally(() => {
      sharedPromise = null;
    });
  return sharedPromise;
}

export function useModels(): { catalogue: ClientCatalogue; loading: boolean } {
  const [catalogue, setCatalogue] = useState<ClientCatalogue>(shared ?? STATIC);
  const [loading, setLoading] = useState(shared === null);

  useEffect(() => {
    let cancelled = false;
    void fetchCatalogue().then((c) => {
      if (cancelled) return;
      setCatalogue(c);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { catalogue, loading };
}
