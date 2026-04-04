import express from "express";
import connection from "../conection";
import { verifyTokenAndTenant } from "../middlewares/authMiddleware";

const router = express.Router();

// Todas las rutas de cajeros requieren autenticación y Tenant
router.use(verifyTokenAndTenant);

router.get("/", (req: any, res: any) => {
  const empresa_id = req.user.empresa_id;
  connection.query("SELECT * FROM cajeros WHERE empresa_id = ?", [empresa_id], (err: any, results: any) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

router.post("/", (req: any, res: any) => {
  const empresa_id = req.user.empresa_id;
  const { nombre, documento, telefono, direccion, fecha_contrato, salario, paga_comisiones, porcentaje_comision } = req.body;
  if (!nombre) return res.status(400).json({ error: "Nombre es requerido" });

  const query = `
    INSERT INTO cajeros (empresa_id, nombre, documento, telefono, direccion, fecha_contrato, salario, paga_comisiones, porcentaje_comision) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  connection.query(
    query,
    [
      empresa_id,
      nombre, 
      documento || '',
      telefono || '',
      direccion || '',
      fecha_contrato || null,
      salario || 0,
      paga_comisiones ? 1 : 0,
      porcentaje_comision || 0
    ],
    (err: any, results: any) => {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ id: results.insertId, empresa_id, nombre, documento, telefono, direccion, fecha_contrato, salario, paga_comisiones, porcentaje_comision });
    }
  );
});

router.put("/:id", (req: any, res: any) => {
  const empresa_id = req.user.empresa_id;
  const { nombre, documento, telefono, direccion, fecha_contrato, salario, paga_comisiones, porcentaje_comision } = req.body;
  
  if (!nombre) return res.status(400).json({ error: "Nombre es requerido" });

  const query = `
    UPDATE cajeros SET 
      nombre = ?, 
      documento = ?, 
      telefono = ?, 
      direccion = ?, 
      fecha_contrato = ?, 
      salario = ?, 
      paga_comisiones = ?, 
      porcentaje_comision = ?
    WHERE id = ? AND empresa_id = ?
  `;

  connection.query(
    query,
    [
      nombre, 
      documento || '',
      telefono || '',
      direccion || '',
      fecha_contrato || null,
      salario || 0,
      paga_comisiones ? 1 : 0,
      porcentaje_comision || 0,
      req.params.id,
      empresa_id
    ],
    (err: any, results: any) => {
      if (err) return res.status(500).json({ error: err.message });
      if (results.affectedRows === 0) return res.status(404).json({ error: "Cajero no encontrado o no autorizado" });
      res.json({ success: true, message: "Cajero actualizado correctamente" });
    }
  );
});

router.delete("/:id", (req: any, res: any) => {
  const empresa_id = req.user.empresa_id;
  connection.query("DELETE FROM cajeros WHERE id = ? AND empresa_id = ?", [req.params.id, empresa_id], (err: any, results: any) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

export default router;
