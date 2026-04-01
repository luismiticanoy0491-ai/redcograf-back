const express = require("express");
const router = express.Router();
const connection = require("../conection");

// Listar todos los proveedores adaptando los nombres de columnas a lo que espera React
router.get("/", (req, res) => {
  connection.query("SELECT id, nombre as nombre_comercial, contacto as nit, telefono, direccion, email as correo FROM proveedores ORDER BY nombre ASC", (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// Crear un proveedor
router.post("/", (req, res) => {
  const { nombre_comercial, nit, direccion, telefono, correo } = req.body;
  
  if (!nombre_comercial) {
    return res.status(400).json({ error: "El nombre comercial es obligatorio" });
  }

  const query = "INSERT INTO proveedores (nombre, contacto, direccion, telefono, email) VALUES (?, ?, ?, ?, ?)";
  connection.query(query, [nombre_comercial, nit || '', direccion || '', telefono || '', correo || ''], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ id: results.insertId, message: "Proveedor registrado con éxito" });
  });
});

module.exports = router;

export {};
