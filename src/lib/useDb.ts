"use client";

import { useEffect, useState, useCallback } from "react";
import { getDb } from "./store";
import type { Database } from "./types";

// Hook simples: lê o banco (localStorage) e re-renderiza sempre que algo
// muda (inclusive quando outra aba altera os dados). Substitui os
// re-fetches automáticos que o Next fazia via revalidatePath no servidor.
export function useDb() {
  const [db, setDb] = useState<Database | null>(null);

  const reload = useCallback(() => {
    setDb(getDb());
  }, []);

  useEffect(() => {
    reload();
    const handler = () => reload();
    window.addEventListener("calculadora-db-changed", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("calculadora-db-changed", handler);
      window.removeEventListener("storage", handler);
    };
  }, [reload]);

  return db;
}
