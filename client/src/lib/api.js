const BASE = "/api";

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      ...(options.body && !(options.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  const isJson = res.headers.get("content-type")?.includes("application/json");
  const data = isJson ? await res.json() : null;
  if (!res.ok) {
    throw new Error(data?.error || `Error ${res.status}`);
  }
  return data;
}

// Descarga un archivo protegido con la clave de admin (export a Excel/CSV).
async function downloadFile(path, password, fallbackFilename) {
  const res = await fetch(`${BASE}${path}`, { headers: { "x-admin-password": password } });
  if (!res.ok) {
    const isJson = res.headers.get("content-type")?.includes("application/json");
    const data = isJson ? await res.json() : null;
    throw new Error(data?.error || `Error ${res.status}`);
  }
  const blob = await res.blob();
  const match = (res.headers.get("content-disposition") || "").match(/filename="?([^"]+)"?/);
  const filename = match ? match[1] : fallbackFilename;
  return { blob, filename };
}

export const api = {
  getTechnicians: () => request("/technicians"),
  getWeeks: () => request("/weeks"),
  getSchedule: (params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v));
    return request(`/schedule?${qs.toString()}`);
  },
  updateStatus: (id, body) =>
    request(`/activities/${id}/status`, { method: "PATCH", body: JSON.stringify(body) }),
  getHistory: (id) => request(`/activities/${id}/history`),
  getLaminadores: () => request("/laminadores"),
  getLaminadorResets: (id) => request(`/laminadores/${id}/resets`),
  addLaminadorReset: (id, body) =>
    request(`/laminadores/${id}/resets`, { method: "POST", body: JSON.stringify(body) }),
  getChecklistItems: () => request("/checklist-items"),
  getLaminadorChecklists: (id) => request(`/laminadores/${id}/checklists`),
  getLaminadorChecklistDetail: (id, reportId) => request(`/laminadores/${id}/checklists/${reportId}`),
  addLaminadorChecklist: (id, body) =>
    request(`/laminadores/${id}/checklists`, { method: "POST", body: JSON.stringify(body) }),
  getRodilloReports: (id) => request(`/laminadores/${id}/rodillo-reports`),
  getRodilloReportDetail: (id, reportId) => request(`/laminadores/${id}/rodillo-reports/${reportId}`),
  addRodilloReport: (id, body) =>
    request(`/laminadores/${id}/rodillo-reports`, { method: "POST", body: JSON.stringify(body) }),
  adminUpdateRodilloReport: (password, id, reportId, body) =>
    request(`/laminadores/${id}/rodillo-reports/${reportId}`, {
      method: "PATCH",
      headers: { "x-admin-password": password },
      body: JSON.stringify(body),
    }),
  adminDeleteLaminadorChecklist: (password, reportId) =>
    request(`/admin/laminadores/checklists/${reportId}`, {
      method: "DELETE",
      headers: { "x-admin-password": password },
    }),
  adminExportLaminadorChecklists: (password, format = "xlsx") =>
    downloadFile(`/admin/laminadores/checklists/export?format=${format}`, password, `checklists.${format}`),
  adminDeleteRodilloReport: (password, reportId) =>
    request(`/admin/laminadores/rodillo-reports/${reportId}`, {
      method: "DELETE",
      headers: { "x-admin-password": password },
    }),
  adminExportRodilloReports: (password, format = "xlsx") =>
    downloadFile(`/admin/laminadores/rodillo-reports/export?format=${format}`, password, `mediciones_rodillos.${format}`),
  adminDeleteLaminadorReset: (password, resetId) =>
    request(`/admin/laminadores/resets/${resetId}`, {
      method: "DELETE",
      headers: { "x-admin-password": password },
    }),
  adminExportLaminadorResets: (password, format = "xlsx") =>
    downloadFile(`/admin/laminadores/resets/export?format=${format}`, password, `reseteos_horometro.${format}`),

  adminLogin: (password) =>
    request("/admin/login", { method: "POST", headers: { "x-admin-password": password } }),
  adminDashboard: (password, week) => {
    const qs = week ? `?week=${week}` : "";
    return request(`/admin/dashboard${qs}`, { headers: { "x-admin-password": password } });
  },
  adminUpload: (password, file, weekStart) => {
    const form = new FormData();
    form.append("file", file);
    form.append("week_start", weekStart);
    return request("/admin/upload", {
      method: "POST",
      headers: { "x-admin-password": password },
      body: form,
    });
  },
  adminGetTechnicians: (password) => request("/admin/technicians", { headers: { "x-admin-password": password } }),
  adminUpdateTechnician: (password, id, body) =>
    request(`/admin/technicians/${id}`, {
      method: "PATCH",
      headers: { "x-admin-password": password },
      body: JSON.stringify(body),
    }),
  adminDeleteWeek: (password, weekStart) =>
    request(`/admin/weeks/${weekStart}`, { method: "DELETE", headers: { "x-admin-password": password } }),
  adminExportHistory: (password, format = "xlsx") =>
    downloadFile(`/admin/export?format=${format}`, password, `historial.${format}`),
};
