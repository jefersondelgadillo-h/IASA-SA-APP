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
};
