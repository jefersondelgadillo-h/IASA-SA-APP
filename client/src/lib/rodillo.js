// Las 4 filas posibles del informe de medicion de rodillos (galga 0,05 mm):
// rodillo fijo/movil, antes/despues de rectificar. El rodillo fijo (R1) usa
// hora y el movil (R2) usa turno, igual que en el formato original.
export const RODILLO_ROWS = [
  { key: "R1AR", group: "Rodillo Fijo", estado: "Antes de rectificar", field: "hora" },
  { key: "R1DR", group: "Rodillo Fijo", estado: "Despues de rectificar", field: "hora" },
  { key: "R2AR", group: "Rodillo Movil", estado: "Antes de rectificar", field: "turno" },
  { key: "R2DR", group: "Rodillo Movil", estado: "Despues de rectificar", field: "turno" },
];

export function rodilloRowInfo(rowKey) {
  return RODILLO_ROWS.find((r) => r.key === rowKey);
}

export function rodilloRowLabel(rowKey) {
  const row = rodilloRowInfo(rowKey);
  return row ? `${row.group} - ${row.estado}` : rowKey;
}
