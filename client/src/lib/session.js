const TECH_KEY = "iasa_technician";
const ADMIN_KEY = "iasa_admin_password";

export function getTechnician() {
  try {
    const raw = localStorage.getItem(TECH_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setTechnician(tech) {
  localStorage.setItem(TECH_KEY, JSON.stringify(tech));
}

export function clearTechnician() {
  localStorage.removeItem(TECH_KEY);
}

export function getAdminPassword() {
  return sessionStorage.getItem(ADMIN_KEY);
}

export function setAdminPassword(pw) {
  sessionStorage.setItem(ADMIN_KEY, pw);
}

export function clearAdminPassword() {
  sessionStorage.removeItem(ADMIN_KEY);
}
