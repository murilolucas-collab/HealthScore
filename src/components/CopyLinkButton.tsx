"use client";

import { useState } from "react";

export default function CopyLinkButton({ url }: { url: string }) {
  const [copiado, setCopiado] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(url);
        setCopiado(true);
        setTimeout(() => setCopiado(false), 2000);
      }}
      className="text-xs text-neutral-600 underline hover:text-neutral-900 shrink-0"
    >
      {copiado ? "Copiado!" : "Copiar link"}
    </button>
  );
}
