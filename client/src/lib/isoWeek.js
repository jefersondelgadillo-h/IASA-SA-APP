// Numeracion de semana ISO-8601 (lunes a domingo, semana 1 = la que
// contiene el primer jueves del año) — la misma que usa la planta para
// hablar de "semana 39", etc.
export function getISOWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7; // lunes=1 ... domingo=7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return { year: d.getUTCFullYear(), week };
}

function shortDayMonth(d) {
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// weekStartISO: "YYYY-MM-DD" (lunes de esa semana). Ej: "Semana 39 (21/09 - 27/09)".
export function formatWeekLabel(weekStartISO) {
  const monday = new Date(`${weekStartISO}T00:00:00`);
  if (isNaN(monday)) return weekStartISO;
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  const { week } = getISOWeek(monday);
  return `Semana ${week} (${shortDayMonth(monday)} - ${shortDayMonth(sunday)})`;
}

// Version corta para espacios chicos (badges, chips): "Semana 39", sin rango de fechas.
export function formatWeekShort(weekStartISO) {
  const monday = new Date(`${weekStartISO}T00:00:00`);
  if (isNaN(monday)) return weekStartISO;
  const { week } = getISOWeek(monday);
  return `Semana ${week}`;
}

// El lunes de la semana actual (segun la fecha local del dispositivo).
export function currentMonday() {
  const today = new Date();
  const diffToMonday = (today.getDay() + 6) % 7; // lunes=0 ... domingo=6
  const monday = new Date(today);
  monday.setDate(today.getDate() - diffToMonday);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

// Opciones de semana (lunes ISO + etiqueta) alrededor de la semana actual,
// para selects que necesitan elegir una semana que todavia no existe en la
// base (ej. subir el Excel de una semana nueva).
export function generateWeekOptions(weeksBefore = 12, weeksAfter = 8) {
  const thisMonday = currentMonday();
  const options = [];
  for (let i = weeksAfter; i >= -weeksBefore; i--) {
    const monday = new Date(thisMonday);
    monday.setDate(thisMonday.getDate() + i * 7);
    const iso = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(
      monday.getDate()
    ).padStart(2, "0")}`;
    options.push({ value: iso, label: formatWeekLabel(iso) });
  }
  return options;
}
