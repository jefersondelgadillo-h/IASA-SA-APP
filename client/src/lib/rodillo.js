// Los 2 rodillos que se miden (fijo/movil). El rodillo fijo usa hora y el
// movil usa turno, igual que en el formato original. Cada ciclo de
// rectificacion queda en un mismo registro: se abre con "antes de
// rectificar" y se completa despues con "despues de rectificar".
export const RODILLOS = [
  { key: "fijo", label: "Rodillo Fijo", field: "hora" },
  { key: "movil", label: "Rodillo Movil", field: "turno" },
];

export function rodilloInfo(key) {
  return RODILLOS.find((r) => r.key === key);
}

export function rodilloLabel(key) {
  return rodilloInfo(key)?.label || key;
}
