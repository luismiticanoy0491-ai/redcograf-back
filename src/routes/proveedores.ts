import express from "express";
import connection from "../conection";
import { verifyTokenAndTenant } from "../middlewares/authMiddleware";

const router = express.Router();

// Interceptar y proteger todas las rutas de proveedores
router.use(verifyTokenAndTenant);

// Listar proveedores filtrados por empresa
router.get("/", (req: any, res: any) => {
  const empresa_id = req.user.empresa_id;
  connection.query(
    "SELECT id, nombre as nombre_comercial, contacto as nit, telefono, direccion, email as correo FROM proveedores WHERE empresa_id = ? ORDER BY nombre ASC", 
    [empresa_id],
    (err: any, results: any[]) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(results);
    }
  );
});

// Crear un proveedor amarrado a la empresa actual
router.post("/", (req: any, res: any) => {
  const empresa_id = req.user.empresa_id;
  const { nombre_comercial, nit, direccion, telefono, correo } = req.body;
  
  if (!nombre_comercial) {
    return res.status(400).json({ error: "El nombre comercial es obligatorio" });
  }

  const query = "INSERT INTO proveedores (empresa_id, nombre, contacto, direccion, telefono, email) VALUES (?, ?, ?, ?, ?, ?)";
  connection.query(query, [empresa_id, nombre_comercial, nit || '', direccion || '', telefono || '', correo || ''], (err: any, results: any) => {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ id: results.insertId, message: "Proveedor registrado con éxito" });
  });
});

// Actualizar garantizando que el proveedor pertenezca a la empresa
router.put("/:id", (req: any, res: any) => {
  const empresa_id = req.user.empresa_id;
  const { id } = req.params;
  const { nombre_comercial, nit, direccion, telefono, correo } = req.body;
  
  if (!nombre_comercial) {
    return res.status(400).json({ error: "El nombre comercial es obligatorio" });
  }

  const query = "UPDATE proveedores SET nombre = ?, contacto = ?, direccion = ?, telefono = ?, email = ? WHERE id = ? AND empresa_id = ?";
  connection.query(query, [nombre_comercial, nit || '', direccion || '', telefono || '', correo || '', id, empresa_id], (err: any, results: any) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.affectedRows === 0) return res.status(404).json({ error: "Proveedor no encontrado o no autorizado" });
    res.json({ success: true, message: "Proveedor actualizado con éxito" });
  });
});

// Eliminar garantizando propiedad de la empresa
router.delete("/:id", (req: any, res: any) => {
  const empresa_id = req.user.empresa_id;
  const { id } = req.params;
  connection.query("DELETE FROM proveedores WHERE id = ? AND empresa_id = ?", [id, empresa_id], (err: any, results: any) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.affectedRows === 0) return res.status(404).json({ error: "Proveedor no encontrado o no autorizado" });
    res.json({ success: true, message: "Proveedor eliminado con éxito" });
  });
});

export default router;
