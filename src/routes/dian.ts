import { Router } from "express";
import pool from "../conection";
import { verifyTokenAndTenant } from "../middlewares/authMiddleware";

const router = Router();

// Middleware de seguridad
router.use(verifyTokenAndTenant);

// --- GESTIÓN DE RESOLUCIONES DIAN ---

// Listar resoluciones de la empresa
router.get("/resoluciones", (req: any, res) => {
  const empresa_id = req.user.empresa_id;
  const query = "SELECT * FROM dian_resoluciones WHERE empresa_id = ? ORDER BY activa DESC, created_at DESC";
  pool.query(query, [empresa_id], (err, results) => {
    if (err) return res.status(500).json({ error: "Error al obtener resoluciones" });
    res.json(results);
  });
});

// Guardar nueva resolución
router.post("/resoluciones", (req: any, res) => {
  const empresa_id = req.user.empresa_id;
  const { prefijo, numero_resolucion, fecha_resolucion, rango_desde, rango_hasta, fecha_inicio, fecha_fin, clave_tecnica, ambiente } = req.body;

  const query = `
    INSERT INTO dian_resoluciones 
    (empresa_id, prefijo, numero_resolucion, fecha_resolucion, rango_desde, rango_hasta, consecutivo_actual, fecha_inicio, fecha_fin, clave_tecnica, ambiente, activa)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE)
  `;

  pool.query(query, [empresa_id, prefijo, numero_resolucion, fecha_resolucion, rango_desde, rango_hasta, rango_desde, fecha_inicio, fecha_fin, clave_tecnica, ambiente], (err) => {
    if (err) return res.status(500).json({ error: "Error al guardar resolución" });
    res.json({ message: "Resolución guardada correctamente" });
  });
});

// Desactivar/Activar resolución
router.put("/resoluciones/:id/estado", (req: any, res) => {
  const empresa_id = req.user.empresa_id;
  const { activa } = req.body;
  const { id } = req.params;

  pool.query("UPDATE dian_resoluciones SET activa = ? WHERE id = ? AND empresa_id = ?", [activa, id, empresa_id], (err) => {
    if (err) return res.status(500).json({ error: "Error al actualizar estado" });
    res.json({ message: "Estado actualizado" });
  });
});

export default router;
