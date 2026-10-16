"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AuthProvider } from "@/lib/auth-client";
import { useGithubAutoSync } from "@/lib/github-sync";
import Sidebar from "@/components/Sidebar";

function AppFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const standalone = pathname === "/login" || pathname.startsWith("/responder");
  useGithubAutoSync();
  if (standalone) return <main className="min-h-screen w-full">{children}</main>;
  return (
    <div className="flex min-h-screen w-full">
      <Sidebar />
      <main className="app-main"><div>{children}</div></main>
      <SyncNotice />
    </div>
  );
}

type SyncMessage = { status: "salvando" | "salvo" | "erro"; erro?: string };

function SyncNotice() {
  const [message, setMessage] = useState<SyncMessage | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    function onSync(event: Event) {
      const detail = (event as CustomEvent<SyncMessage>).detail;
      setMessage(detail);
      if (timer) clearTimeout(timer);
      if (detail.status !== "salvando") timer = setTimeout(() => setMessage(null), detail.status === "erro" ? 9000 : 3000);
    }
    window.addEventListener("healthscore-sync-state", onSync);
    return () => { window.removeEventListener("healthscore-sync-state", onSync); if (timer) clearTimeout(timer); };
  }, []);
  if (!message) return null;
  const erro = message.status === "erro";
  const texto = message.status === "salvando" ? "Salvando alterações…" : message.status === "salvo" ? "Alterações sincronizadas." : `Salvas neste navegador. Sincronização remota falhou${message.erro ? `: ${message.erro}` : "."}`;
  return <div role={erro ? "alert" : "status"} className={`sync-notice ${erro ? "sync-notice-error" : ""}`}><span aria-hidden="true">{message.status === "salvando" ? "◌" : erro ? "!" : "✓"}</span>{texto}</div>;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="grid min-h-screen w-full place-items-center text-sm text-neutral-500">Carregando HealthScore…</div>}>
      <AuthProvider><AppFrame>{children}</AppFrame></AuthProvider>
    </Suspense>
  );
}
