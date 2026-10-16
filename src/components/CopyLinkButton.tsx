"use client";

import { useState } from "react";

export default function CopyLinkButton({ url }: { url: string }) {
  const [copiado, setCopiado] = useState(false);
  const [erro, setErro] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        setCopiado(false);
        setErro(false);

        try {
          if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(url);
          } else {
            throw new Error("Clipboard API indisponível");
          }
          setCopiado(true);
        } catch {
          const campo = document.createElement("textarea");
          campo.value = url;
          campo.setAttribute("readonly", "");
          campo.style.position = "fixed";
          campo.style.opacity = "0";
          document.body.appendChild(campo);
          campo.select();
          const conseguiuCopiar = document.execCommand("copy");
          campo.remove();

          if (conseguiuCopiar) setCopiado(true);
          else setErro(true);
        }

        window.setTimeout(() => {
          setCopiado(false);
          setErro(false);
        }, 2500);
      }}
      className="inline-action inline-action-secondary shrink-0"
      aria-live="polite"
    >
      {copiado ? "Copiado!" : erro ? "Não foi possível copiar" : "Copiar link"}
    </button>
  );
}
