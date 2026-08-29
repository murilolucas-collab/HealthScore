"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-client";

export default function LoginPage() {
  const { login } = useAuth();
  const [erro, setErro] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    const formData = new FormData(e.currentTarget);
    const email = String(formData.get("email") ?? "");
    const senha = String(formData.get("senha") ?? "");
    const resultado = login(email, senha);
    if (!resultado.ok) {
      setErro(resultado.erro);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-sm bg-white rounded-xl shadow-sm border border-neutral-200 p-8">
        <h1 className="text-xl font-semibold text-neutral-900 mb-1">Saúde de Clientes</h1>
        <p className="text-sm text-neutral-500 mb-6">
          Entre para acessar seus projetos e o risco de churn.
        </p>

        {erro && (
          <p className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
            {erro}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Email</label>
            <input
              type="email"
              name="email"
              required
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
              placeholder="admin@agencia.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Senha</label>
            <input
              type="password"
              name="senha"
              required
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            className="w-full bg-neutral-900 text-white rounded-md py-2 text-sm font-medium hover:bg-neutral-800 transition"
          >
            Entrar
          </button>
        </form>

        <p className="mt-6 text-xs text-neutral-400">
          Usuário de teste: admin@agencia.com / admin123
        </p>
      </div>
    </div>
  );
}
