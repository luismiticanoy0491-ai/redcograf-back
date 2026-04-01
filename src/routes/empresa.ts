const express = require("express");
const router = express.Router();
const connection = require("../conection");

// Obtener datos globales de la empresa
router.get("/", (req, res) => {
  connection.query("SELECT * FROM empresa_config WHERE id = 1", (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length === 0) return res.status(404).json({ error: "Datos no encontrados" });
    res.json(results[0]);
  });
});

// Sobreescribir configuración
router.put("/", (req, res) => {
  const { nombre_empresa, nit, direccion, telefono, correo, resolucion } = req.body;
  
  if (!nombre_empresa || !nit || !direccion || !correo || !resolucion) {
    return res.status(400).json({ error: "Todos los campos obligatorios deben estar presentes" });
  }

  const query = `
    UPDATE empresa_config 
    SET nombre_empresa = ?, nit = ?, direccion = ?, telefono = ?, correo = ?, resolucion = ?
    WHERE id = 1
  `;
  
  connection.query(query, [nombre_empresa, nit, direccion, telefono || "", correo, resolucion], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: "Configuración actualizada con éxito" });
  });
});

module.exports = router;

export {};
