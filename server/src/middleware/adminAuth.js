/**
 * Autenticacion simple para el panel de administracion.
 * El cliente envia la clave en el header "x-admin-password" (la guarda en localStorage
 * despues de que el supervisor la escribe una vez).
 */
export function adminAuth(req, res, next) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    return res.status(500).json({ error: "El servidor no tiene configurada ADMIN_PASSWORD." });
  }
  const provided = req.header("x-admin-password");
  if (provided !== expected) {
    return res.status(401).json({ error: "Clave de administrador invalida." });
  }
  next();
}
