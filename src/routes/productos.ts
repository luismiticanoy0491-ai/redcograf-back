import express from "express";
import connection from "../conection";
import { verifyTokenAndTenant } from "../middlewares/authMiddleware";

const router = express.Router();

// Todas las rutas de productos requieren autenticación y Tenant
router.use(verifyTokenAndTenant);

router.get("/", (req: any, res: any) => {
  let queryEmpresaId = req.user.empresa_id;
  
  if(req.user.role === 'superadmin') {
     const filterEmpresa = req.query.empresa_id;
     if(!filterEmpresa) {
        connection.query("SELECT * FROM productos ORDER BY id DESC", (err: any, results: any) => {
          if (err) {
             console.error("DB Error:", err);
             if (!res.headersSent) return res.status(500).json({ error: "Error en el servidor" });
             return;
          }
          if (!res.headersSent) return res.json(results);
        });
        return;
     }
     queryEmpresaId = filterEmpresa;
  }

  connection.query("SELECT * FROM productos WHERE empresa_id = ? ORDER BY id DESC", [queryEmpresaId], (err: any, results: any) => {
    if (err) {
      console.error("Error al obtener productos:", err);
      return res.status(500).json({ error: "Error en el servidor" });
    }
    res.json(results);
  });
});

// Buscar producto por su código de barras (referencia)
router.get("/buscar/:referencia", (req: any, res: any) => {
  const empresa_id = req.user.empresa_id;
  const { referencia } = req.params;
  connection.query(
    "SELECT * FROM productos WHERE empresa_id = ? AND referencia = ? LIMIT 1", 
    [empresa_id, referencia], 
    (err: any, results: any[]) => {
      if (err) {
        console.error("Error al buscar el producto:", err);
        return res.status(500).json({ error: "Error en el servidor" });
      }
      if (results.length > 0) {
        res.json(results[0]);
      } else {
        res.status(404).json({ message: "Producto no encontrado en tu inventario" });
      }
    }
  );
});

// Guardado de un producto individual
router.post("/", (req: any, res: any) => {
  const empresa_id = req.user.empresa_id;
  const { referencia, nombre, categoria, cantidad, precio_compra, porcentaje_ganancia, precio_venta } = req.body;
  
  const query = `
    INSERT INTO productos (empresa_id, referencia, nombre, categoria, cantidad, precio_compra, porcentaje_ganancia, precio_venta) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;
  
  connection.query(
    query, 
    [empresa_id, referencia || '', nombre, categoria, cantidad, precio_compra, porcentaje_ganancia, precio_venta], 
    (err: any, results: any) => {
      if (err) {
        console.error("Error al insertar producto:", err);
        return res.status(500).json({ error: "Error insertando producto" });
      }
      res.status(201).json({ id: results.insertId, empresa_id, referencia, nombre, categoria, cantidad, precio_compra, porcentaje_ganancia, precio_venta });
    }
  );
});

// Guardado en Lote (Batch)
router.post("/batch", async (req: any, res: any) => {
  const empresa_id = req.user.empresa_id;
  const productos = req.body; 
  
  if (!Array.isArray(productos) || productos.length === 0) {
    return res.status(400).json({ error: "No se proporcionaron productos válidos." });
  }

  try {
    const promiseDb = connection.promise();
    for (const p of productos) {
      if (p.referencia && p.referencia.trim() !== '') {
        const [existing] = await promiseDb.query("SELECT id FROM productos WHERE empresa_id = ? AND referencia = ? ORDER BY id DESC LIMIT 1", [empresa_id, p.referencia]);
        
        if ((existing as any[]).length > 0) {
          // Si existe, suma la cantidad e iguala los precios actuales a la nueva compra
          await promiseDb.query(
            "UPDATE productos SET cantidad = cantidad + ?, precio_compra = ?, precio_venta = ?, porcentaje_ganancia = ? WHERE id = ? AND empresa_id = ?",
            [p.cantidad, p.precio_compra, p.precio_venta, p.porcentaje_ganancia, (existing as any[])[0].id, empresa_id]
          );
          continue;
        }
      }
      
      // Si no existe, lo creamos como nuevo
      await promiseDb.query(
        "INSERT INTO productos (empresa_id, referencia, nombre, categoria, cantidad, precio_compra, porcentaje_ganancia, precio_venta) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [empresa_id, p.referencia || '', p.nombre, p.categoria, p.cantidad, p.precio_compra, p.porcentaje_ganancia, p.precio_venta]
      );
    }
    
    res.status(201).json({ message: "Lote guardado con éxito y unidades sumadas correctamente", affectedRows: productos.length });
  } catch (err) {
    console.error("Error al procesar lote de productos:", err);
    res.status(500).json({ error: "Error actualizando el inventario por lotes" });
  }
});

// Ajuste rápido de inventario (Forzar Nueva Cantidad)
router.put("/:id/ajustar", (req: any, res: any) => {
  const empresa_id = req.user.empresa_id;
  const productoId = req.params.id;
  const { nueva_cantidad } = req.body;

  if (nueva_cantidad === undefined || isNaN(nueva_cantidad)) {
    return res.status(400).json({ error: "Cantidad no válida proporcionada para el ajuste" });
  }

  const query = "UPDATE productos SET cantidad = ? WHERE id = ? AND empresa_id = ?";
  
  connection.query(query, [parseInt(nueva_cantidad, 10), productoId, empresa_id], (err: any, results: any) => {
    if (err) {
      console.error("Error forzando stock:", err);
      return res.status(500).json({ error: "No se pudo ajustar el inventario" });
    }
    
    if (results.affectedRows === 0) {
      return res.status(404).json({ error: "Producto no existe o no pertenece a tu inventario" });
    }

    res.json({ success: true, message: "Inventario corregido / nivelado correctamente." });
  });
});

// Revertir (restar) stock de un producto inyectado desde un borrador
router.post("/revertir-stock", async (req: any, res: any) => {
  const empresa_id = req.user.empresa_id;
  const { referencia, nombre, cantidad } = req.body;
  
  if (!cantidad || isNaN(cantidad)) {
    return res.status(400).json({ error: "Cantidad no válida" });
  }

  const promiseDb = connection.promise();
  try {
    if (referencia && referencia.trim() !== "") {
       await promiseDb.query("UPDATE productos SET cantidad = cantidad - ? WHERE empresa_id = ? AND referencia = ? ORDER BY id DESC LIMIT 1", [cantidad, empresa_id, referencia]);
    } else if (nombre) {
       await promiseDb.query("UPDATE productos SET cantidad = cantidad - ? WHERE empresa_id = ? AND nombre = ? ORDER BY id DESC LIMIT 1", [cantidad, empresa_id, nombre]);
    } else {
       return res.status(400).json({ error: "Especifica referencia o nombre" });
    }
    
    res.json({ success: true, message: "Stock descontado exitosamente" });
  } catch(err) {
    console.error("Error revirtiendo stock:", err);
    res.status(500).json({ error: "No se pudo revertir el stock" });
  }
});

export default router;
