import express from "express";
import connection from "../conection";
import { verifyTokenAndTenant } from "../middlewares/authMiddleware";

const router = express.Router();

// Blindaje de seguridad y aislamiento por tienda
router.use(verifyTokenAndTenant);

// Obtener borradores filtrados por empresa
router.get("/", (req: any, res: any) => {
  const empresa_id = req.user.empresa_id;
  connection.query(
    "SELECT * FROM facturas_borrador WHERE empresa_id = ? ORDER BY fecha DESC", 
    [empresa_id],
    (err: any, results: any[]) => {
      if (err) return res.status(500).json({ error: "Error obteniendo borradores" });
      res.json(results);
    }
  );
});

// Guardar o actualizar un borrador inyectando al inventario privado
router.post("/", async (req: any, res: any) => {
  const empresa_id = req.user.empresa_id;
  const { proveedor, numero_factura, datos_json } = req.body;
  
  if (!datos_json || !Array.isArray(datos_json)) return res.status(400).json({ error: "Datos vacíos" });

  const promiseDb = connection.promise();

  try {
    // 1. Inyectar productos al inventario privado de la tienda actual
    for (let p of datos_json) {
      if (!p.inyectado) {
        let existing: any[] = [];
        if (p.referencia && p.referencia.trim() !== '') {
          // BUSCAR SOLO EN LA EMPRESA ACTUAL
          const [res]: any = await promiseDb.query(
            "SELECT id FROM productos WHERE referencia = ? AND empresa_id = ? ORDER BY id DESC LIMIT 1", 
            [p.referencia, empresa_id]
          );
          existing = res;
        }
        
        if (existing.length > 0) {
          const finalCantidad = p.es_servicio ? 0 : p.cantidad;
          await promiseDb.query(
            "UPDATE productos SET cantidad = cantidad + ?, precio_compra = ?, precio_venta = ?, porcentaje_ganancia = ?, es_servicio = ?, permitir_venta_negativa = ? WHERE id = ? AND empresa_id = ?",
            [finalCantidad, p.precio_compra, p.precio_venta, p.porcentaje_ganancia, p.es_servicio ? 1 : 0, p.permitir_venta_negativa ? 1 : 0, existing[0].id, empresa_id]
          );
        } else {
          const finalCantidad = p.es_servicio ? 0 : p.cantidad;
          await promiseDb.query(
            "INSERT INTO productos (empresa_id, referencia, nombre, categoria, cantidad, precio_compra, porcentaje_ganancia, precio_venta, es_servicio, permitir_venta_negativa) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [empresa_id, p.referencia || '', p.nombre, p.categoria || 'Sin Categoría', finalCantidad, p.precio_compra, p.porcentaje_ganancia, p.precio_venta, p.es_servicio ? 1 : 0, p.permitir_venta_negativa ? 1 : 0]
          );
        }
        
        p.inyectado = true;
      }
    }

    const query = "INSERT INTO facturas_borrador (empresa_id, proveedor, numero_factura, datos_json) VALUES (?, ?, ?, ?)";
    const [results]: any = await promiseDb.query(query, [empresa_id, proveedor || '', numero_factura || '', JSON.stringify(datos_json)]);

    res.status(201).json({ id: results.insertId, empresa_id, proveedor, numero_factura, datos_json });
  } catch (err) {
    console.error("Critical Draft Injection Error:", err);
    res.status(500).json({ error: "No se pudo inyectar el producto al inventario." });
  }
});

// Borrar un borrador con validación de propiedad
router.delete("/:id", (req: any, res: any) => {
  const empresa_id = req.user.empresa_id;
  const { id } = req.params;
  connection.query(
    "DELETE FROM facturas_borrador WHERE id = ? AND empresa_id = ?", 
    [id, empresa_id], 
    (err, results: any) => {
      if (err) return res.status(500).json({ error: "Error eliminando borrador" });
      if (results.affectedRows === 0) return res.status(404).json({ error: "Borrador no encontrado o no pertenece a tu tienda" });
      res.json({ success: true });
    }
  );
});

export default router;
