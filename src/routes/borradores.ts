import express from "express";
import connection from "../conection";

const router = express.Router();

// Obtener todos los borradores (al listar para cargar)
router.get("/", (req, res) => {
  connection.query("SELECT * FROM facturas_borrador ORDER BY fecha DESC", (err: any, results: any[]) => {
    if (err) return res.status(500).json({ error: "Error obteniendo borradores" });
    res.json(results);
  });
});

// Guardar o actualizar un borrador (Upsert simple: si tiene ID borramos el anterior, o mejor crear uno nuevo y borrar)
router.post("/", async (req, res) => {
  const { proveedor, numero_factura, datos_json } = req.body;
  
  if (!datos_json || !Array.isArray(datos_json)) return res.status(400).json({ error: "Datos vacíos" });

  const promiseDb = connection.promise();

  try {
    // 1. Inyectar productos no inyectados al inventario inmediatamente para que se puedan vender
    for (let p of datos_json) {
      if (!p.inyectado) {
        let existing: any[] = [];
        if (p.referencia && p.referencia.trim() !== '') {
          const [res]: any = await promiseDb.query("SELECT id FROM productos WHERE referencia = ? ORDER BY id DESC LIMIT 1", [p.referencia]);
          existing = res;
        }
        
        if (existing.length > 0) {
          await promiseDb.query(
            "UPDATE productos SET cantidad = cantidad + ?, precio_compra = ?, precio_venta = ?, porcentaje_ganancia = ? WHERE id = ?",
            [p.cantidad, p.precio_compra, p.precio_venta, p.porcentaje_ganancia, existing[0].id]
          );
        } else {
          await promiseDb.query(
            "INSERT INTO productos (referencia, nombre, categoria, cantidad, precio_compra, porcentaje_ganancia, precio_venta) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [p.referencia || '', p.nombre, p.categoria || 'Sin Categoría', p.cantidad, p.precio_compra, p.porcentaje_ganancia, p.precio_venta]
          );
        }
        
        p.inyectado = true;
      }
    }

    const query = "INSERT INTO facturas_borrador (proveedor, numero_factura, datos_json) VALUES (?, ?, ?)";
    const [results]: any = await promiseDb.query(query, [proveedor || '', numero_factura || '', JSON.stringify(datos_json)]);

    res.status(201).json({ id: results.insertId, proveedor, numero_factura, datos_json });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error guardando borrador e inyectando al inventario" });
  }
});

// Borrar un borrador (ej. cuando se completa y se envía al inventario final)
router.delete("/:id", (req, res) => {
  const { id } = req.params;
  connection.query("DELETE FROM facturas_borrador WHERE id = ?", [id], (err, results) => {
    if (err) return res.status(500).json({ error: "Error eliminando borrador" });
    res.json({ success: true });
  });
});

export default router;
