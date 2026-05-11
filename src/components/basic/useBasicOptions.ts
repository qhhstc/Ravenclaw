"use client";

import { useCallback, useEffect, useState } from "react";
import type { BasicOptionState, BasicRecord } from "./types";

type OptionResponse<T extends BasicRecord> = {
  items: T[];
};

const emptyOptions: BasicOptionState = {
  brands: [],
  platforms: [],
  stores: [],
  countries: [],
  currencies: [],
};

async function fetchOptions<T extends BasicRecord>(path: string, mapper: (item: T) => { label: string; value: string | number }) {
  const response = await fetch(`${path}?page=1&pageSize=100&status=active`);
  const data = (await response.json()) as OptionResponse<T>;
  if (!response.ok) return [];
  return data.items.map(mapper);
}

export function useBasicOptions() {
  const [options, setOptions] = useState<BasicOptionState>(emptyOptions);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [brands, platforms, stores, countries, currencies] = await Promise.all([
        fetchOptions<{ id: number; name: string; code?: string }>("/api/basic/brands", (item) => ({
          label: item.code ? `${item.name} (${item.code})` : item.name,
          value: item.id,
        })),
        fetchOptions<{ id: number; name: string; code?: string }>("/api/basic/platforms", (item) => ({
          label: item.code ? `${item.name} (${item.code})` : item.name,
          value: item.id,
        })),
        fetchOptions<{ id: number; name: string }>("/api/basic/stores", (item) => ({
          label: item.name,
          value: item.id,
        })),
        fetchOptions<{ id: number; name: string; code: string }>("/api/basic/countries", (item) => ({
          label: `${item.name} (${item.code})`,
          value: item.code,
        })),
        fetchOptions<{ id: number; code: string; name: string }>("/api/basic/currencies", (item) => ({
          label: `${item.code} ${item.name}`,
          value: item.code,
        })),
      ]);
      setOptions({ brands, platforms, stores, countries, currencies });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(refresh);
  }, [refresh]);

  return { options, loading, refresh };
}
