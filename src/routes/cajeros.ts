import express from "express";
import connection from "../conection";
import { verifyTokenAndTenant } from "../middlewares/authMiddleware";

const router = express.Router();

// Todas las rutas de cajeros requieren autenticación y Tenant
router.use(verifyTokenAndTenant);

router.get("/", (req: any, res: any) => {
  const empresa_id = req.user.empresa_id;
  connection.query("SELECT * FROM cajeros WHERE empresa_id = ?", [empresa_id], (err: any, results: any) => {
    if (err) return res.status(500).json({ error: "No se pudo obtener la lista de empleados. Por favor, refresque la página." });
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
      if (err) {
        console.error("Error al crear cajero:", err);
        return res.status(500).json({ error: "No se pudo registrar al vendedor. Verifique que los datos sean correctos o intente más tarde." });
      }
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
      if (err) return res.status(500).json({ error: "Error al actualizar la información del vendedor." });
      if (results.affectedRows === 0) return res.status(404).json({ error: "Vendedor no encontrado o no tiene permisos para editarlo." });
      res.json({ success: true, message: "Vendedor actualizado correctamente" });
    }
  );
});

router.delete("/:id", (req: any, res: any) => {
  const empresa_id = req.user.empresa_id;
  connection.query("DELETE FROM cajeros WHERE id = ? AND empresa_id = ?", [req.params.id, empresa_id], (err: any, results: any) => {
    if (err) return res.status(500).json({ error: "No se pudo eliminar al vendedor. Es posible que tenga registros de ventas o pagos asociados." });
    res.json({ success: true, message: "Vendedor eliminado exitosamente." });
  });
});

export default router;
