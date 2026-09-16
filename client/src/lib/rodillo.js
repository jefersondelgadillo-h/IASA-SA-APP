// Los 2 rodillos que se miden (fijo/movil), ambos por hora. Cada ciclo de
// rectificacion queda en un mismo registro: se abre con "antes de
// rectificar" y se completa despues con "despues de rectificar".
export const RODILLOS = [
  { key: "fijo", label: "Rodillo Fijo" },
  { key: "movil", label: "Rodillo Movil" },
];

export function rodilloInfo(key) {
  return RODILLOS.find((r) => r.key === key);
}

export function rodilloLabel(key) {
  return rodilloInfo(key)?.label || key;
}
