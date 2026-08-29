import type { NextConfig } from "next";

// Export 100% estático: não há backend, banco de dados ou API routes.
// Todos os dados vivem em localStorage, no navegador de quem usa o app.
// Isso gera uma pasta "out/" pronta para qualquer hospedagem estática (Netlify, etc).
const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
};

export default nextConfig;
