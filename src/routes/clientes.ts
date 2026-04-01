const express = require("express");
const router = express.Router();
const connection = require("../conection");
const { verifyTokenAndTenant } = require("../middlewares/authMiddleware");

// Interceptar y proteger todas las rutas de clientes
router.use(verifyTokenAndTenant);

router.get("/", (req: any, res: any) => {
  const empresa_id = req.user.empresa_id;
  connection.query("SELECT * FROM clientes WHERE empresa_id = ?", [empresa_id], (err: any, results: any) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

router.post("/", (req: any, res: any) => {
  const empresa_id = req.user.empresa_id;
  const { nombre, documento, telefono, correo, direccion } = req.body;
  if (!nombre) return res.status(400).json({ error: "Nombre es requerido" });

  connection.query(
    "INSERT INTO clientes (empresa_id, nombre, documento, telefono, correo, direccion) VALUES (?, ?, ?, ?, ?, ?)",
    [empresa_id, nombre, documento || '', telefono || '', correo || '', direccion || ''],
    (err: any, results: any) => {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ id: results.insertId, empresa_id, nombre, documento, telefono, correo, direccion });
    }
  );
});

router.delete("/:id", (req: any, res: any) => {
  const empresa_id = req.user.empresa_id;
  connection.query("DELETE FROM clientes WHERE id = ? AND empresa_id = ?", [req.params.id, empresa_id], (err: any, results: any) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

module.exports = router;
export {};
