"use client";

import { Suspense } from "react";
import { AuthProvider } from "@/lib/auth-client";
import { useGithubAutoSync } from "@/lib/github-sync";
import Sidebar from "@/components/Sidebar";

export default function Providers({ children }: { children: React.ReactNode }) {
  useGithubAutoSync();

  return (
    <Suspense fallback={null}>
      <AuthProvider>
        <Sidebar />
        <main className="flex-1 min-w-0 px-6 py-6">
          <div className="max-w-5xl mx-auto">{children}</div>
        </main>
      </AuthProvider>
    </Suspense>
  );
}
