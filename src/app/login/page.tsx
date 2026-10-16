"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-client";
import Image from "next/image";

export default function LoginPage() {
  const { login, pronto } = useAuth();
  const [erro, setErro] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    const formData = new FormData(e.currentTarget);
    const resultado = login(String(formData.get("email") ?? ""), String(formData.get("senha") ?? ""));
    if (!resultado.ok) setErro(resultado.erro);
  }

  return (
    <div className="login-screen">
      <section className="login-brand-panel">
        <Image src="/3pontos-company.jpg" alt="Logo 3Pontos Company" width={92} height={92} priority />
        <div>
          <h1>Relacionamentos saudáveis. Resultados consistentes.</h1>
          <p>Uma visão clara da experiência de cada cliente, dos projetos e das ações que fazem a diferença.</p>
        </div>
        <span className="text-xs tracking-[.18em] text-teal-100/70">3PONTOS COMPANY · HEALTHSCORE</span>
      </section>
      <section className="login-form-panel">
        <div>
          <div className="mb-8">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[.16em] text-teal-800">Área da equipe</p>
            <h2 className="mb-2 text-2xl font-bold">Acesse sua conta</h2>
            <p className="text-sm text-neutral-500">Entre para acompanhar seus clientes e projetos.</p>
          </div>
          {erro && <p role="alert" className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>}
          <form onSubmit={handleSubmit} className="space-y-5">
            <label className="block text-sm font-medium text-neutral-700">Email
              <input type="email" name="email" autoComplete="username" required className="mt-2 w-full" placeholder="nome@3pontoscompany.com.br" />
            </label>
            <label className="block text-sm font-medium text-neutral-700">Senha
              <input type="password" name="senha" autoComplete="current-password" required className="mt-2 w-full" placeholder="Sua senha" />
            </label>
            <button type="submit" disabled={!pronto} className="action-button action-primary w-full">
              {!pronto ? "Preparando acesso…" : "Entrar no HealthScore"}
            </button>
          </form>
          {!pronto && <p role="status" className="mt-4 text-center text-xs text-neutral-500">Conectando e carregando seus dados…</p>}
        </div>
      </section>
    </div>
  );
}
