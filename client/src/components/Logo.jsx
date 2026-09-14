import { useState } from "react";

// Muestra el logo de IASA (client/public/logo-iasa.png). Si el archivo todavia
// no fue subido al repo, cae de vuelta al texto "IASA SA" automaticamente,
// asi la app nunca muestra un icono roto.
export default function Logo({ className = "h-10", fallbackClassName = "font-bold" }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return <span className={fallbackClassName}>IASA SA</span>;
  }

  return (
    <img
      src="/logo-iasa.png"
      alt="IASA - Industrias de Aceite S.A."
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
