import { Link } from "react-router-dom";

// Boton de volver en el header, para no depender de un enlace al final de
// la pagina (obliga a deslizar hacia abajo). Se ubica a la izquierda, antes
// del logo, en todas las pantallas que no son de entrada.
export default function BackButton({ to }) {
  return (
    <Link
      to={to}
      aria-label="Volver"
      className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-white/15 text-white text-lg leading-none active:bg-white/25 transition"
    >
      ←
    </Link>
  );
}
