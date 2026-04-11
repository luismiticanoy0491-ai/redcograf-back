import express from "express";
import connection from "../conection";
import { verifyTokenAndTenant } from "../middlewares/authMiddleware";

const router = express.Router();

// Todas las rutas de productos requieren autenticación y Tenant
router.use(verifyTokenAndTenant);

// Actualizar un producto existente
router.put("/:id", async (req: any, res: any) => {
  const { empresa_id, role, username } = req.user;
  const productoId = req.params.id;
  const { referencia, nombre, categoria, cantidad, precio_compra, porcentaje_ganancia, precio_venta, es_servicio, permitir_venta_negativa } = req.body;

  const isSuper = role === 'superadmin';
  const promiseDb = connection.promise();
  const conn = await promiseDb.getConnection();

  try {
    await conn.beginTransaction();

    // 1. Obtener estado actual para comparar stock
    const [oldData]: any = await conn.query("SELECT cantidad FROM productos WHERE id = ? FOR UPDATE", [productoId]);
    if (oldData.length === 0) throw new Error("Producto no encontrado");
    const stock_antes = oldData[0].cantidad;

    const finalCantidad = es_servicio ? 0 : cantidad;

    // 2. Ejecutar Update
    const query = isSuper
      ? `UPDATE productos SET referencia = ?, nombre = ?, categoria = ?, cantidad = ?, precio_compra = ?, porcentaje_ganancia = ?, precio_venta = ?, es_servicio = ?, permitir_venta_negativa = ? WHERE id = ?`
      : `UPDATE productos SET referencia = ?, nombre = ?, categoria = ?, cantidad = ?, precio_compra = ?, porcentaje_ganancia = ?, precio_venta = ?, es_servicio = ?, permitir_venta_negativa = ? WHERE id = ? AND empresa_id = ?`;

    const params = [
      referencia || '', 
      nombre, 
      categoria, 
      finalCantidad, 
      precio_compra, 
      porcentaje_ganancia, 
      precio_venta, 
      es_servicio ? 1 : 0, 
      permitir_venta_negativa !== undefined ? (permitir_venta_negativa ? 1 : 0) : 1,
      productoId
    ];
    if (!isSuper) params.push(empresa_id);

    await conn.query(query, params);

    // 3. Si la cantidad cambió manualmente y NO es un servicio, registrar en Kardex
    if (!es_servicio && parseInt(cantidad) !== stock_antes) {
      const diferencia = parseInt(cantidad) - stock_antes;
      await conn.query(
        "INSERT INTO kardex (producto_id, empresa_id, tipo_movimiento, cantidad_antes, cantidad_modificada, cantidad_despues, motivo, usuario_nombre) VALUES (?, ?, 'AJUSTE', ?, ?, ?, ?, ?)",
        [productoId, empresa_id, stock_antes, Math.abs(diferencia), cantidad, 'Edición manual de producto', username || 'Usuario']
      );
    }

    await conn.commit();
    res.json({ success: true, message: "Producto actualizado correctamente" });
  } catch (err: any) {
    await conn.rollback();
    console.error("Error al actualizar producto:", err);
    res.status(500).json({ error: err.message || "No se pudo actualizar el producto" });
  } finally {
    conn.release();
  }
});

// Eliminar un producto con registro en Kardex (Trazabilidad)
router.delete("/:id", async (req: any, res: any) => {
  const empresa_id = req.user.empresa_id;
  const productoId = req.params.id;
  const { motivo, usuario_nombre } = req.body;

  if (!motivo || !usuario_nombre) {
    return res.status(400).json({ error: "El motivo y el nombre de quien elimina son obligatorios para el Kardex." });
  }

  const promiseDb = connection.promise();
  const conn = await promiseDb.getConnection();

  try {
    await conn.beginTransaction();

    // 1. Obtener datos antes de borrar para el historial
    const [results]: any = await conn.query(
      "SELECT nombre, cantidad, referencia FROM productos WHERE id = ? AND empresa_id = ? FOR UPDATE", 
      [productoId, empresa_id]
    );

    if (results.length === 0) throw new Error("Producto no encontrado o no pertenece a tu empresa");

    const { nombre, cantidad, referencia: refOriginal } = results[0];

    // 2. Registrar en Kardex la eliminación
    await conn.query(
      "INSERT INTO kardex (producto_id, empresa_id, tipo_movimiento, cantidad_antes, cantidad_modificada, cantidad_despues, motivo, usuario_nombre, referencia) VALUES (?, ?, 'ELIMINACIÓN', ?, ?, 0, ?, ?, ?)",
      [productoId, empresa_id, cantidad, cantidad, `ELIMINACIÓN: [${nombre}] - ${motivo}`, usuario_nombre, refOriginal || 'S/REF']
    );

    // 3. Proceder con el borrado físico
    await conn.query("DELETE FROM productos WHERE id = ? AND empresa_id = ?", [productoId, empresa_id]);

    await conn.commit();
    res.json({ success: true, message: `Producto ${nombre} eliminado y registrado en Kardex.` });
  } catch (err: any) {
    await conn.rollback();
    console.error("Error al eliminar producto:", err);
    res.status(500).json({ error: err.message || "No se pudo eliminar el producto físicamente" });
  } finally {
    conn.release();
  }
});

router.get("/", (req: any, res: any) => {
  let queryEmpresaId = req.user.empresa_id;
  
  const { tipo } = req.query;
  let baseQuery = "SELECT * FROM productos WHERE empresa_id = ?";
  const params: any[] = [queryEmpresaId];

  if (req.user.role === 'superadmin' && !req.query.empresa_id) {
    baseQuery = "SELECT * FROM productos";
    params.pop(); // Remove empresa_id if superadmin is viewing global
  }

  if (tipo === 'servicio') {
    baseQuery += (baseQuery.includes('WHERE') ? " AND " : " WHERE ") + "es_servicio = 1";
  } else if (tipo === 'producto') {
    baseQuery += (baseQuery.includes('WHERE') ? " AND " : " WHERE ") + "es_servicio = 0";
  }

  baseQuery += " ORDER BY id DESC";

  connection.query(baseQuery, params, (err: any, results: any) => {
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
  const { referencia, nombre, categoria, cantidad, precio_compra, porcentaje_ganancia, precio_venta, es_servicio, permitir_venta_negativa } = req.body;
  
  const query = `
    INSERT INTO productos (empresa_id, referencia, nombre, categoria, cantidad, precio_compra, porcentaje_ganancia, precio_venta, es_servicio, permitir_venta_negativa) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  
    const finalCantidad = es_servicio ? 0 : (cantidad || 0);

    connection.query(
    query, 
    [
      empresa_id, 
      referencia || '', 
      nombre, 
      categoria, 
      finalCantidad, 
      precio_compra, 
      porcentaje_ganancia, 
      precio_venta, 
      es_servicio ? 1 : 0, 
      permitir_venta_negativa !== undefined ? (permitir_venta_negativa ? 1 : 0) : 1
    ], 
    (err: any, results: any) => {
      if (err) {
        console.error("Error al insertar producto:", err);
        return res.status(500).json({ error: "Error insertando producto" });
      }
      const newId = results.insertId;

      // Registro automático en Kardex (ENTRADA inicial) solo si NO es servicio y tiene cantidad
      if (!es_servicio && finalCantidad > 0) {
        connection.query(
          "INSERT INTO kardex (producto_id, empresa_id, tipo_movimiento, cantidad_antes, cantidad_modificada, cantidad_despues, motivo, usuario_nombre) VALUES (?, ?, 'ENTRADA', 0, ?, ?, 'Registro inicial de producto', ?)",
          [newId, empresa_id, finalCantidad, finalCantidad, req.user.username || 'Admin'],
          (errK) => { if (errK) console.error("Kardex Init Error:", errK); }
        );
      }

      res.status(201).json({ id: newId, empresa_id, referencia, nombre, categoria, cantidad, precio_compra, porcentaje_ganancia, precio_venta });
    }
  );
});

// Guardado en Lote (Batch) + Kardex
router.post("/batch", async (req: any, res: any) => {
  const empresa_id = req.user.empresa_id;
  const productosData = req.body; 
  
  if (!Array.isArray(productosData) || productosData.length === 0) {
    return res.status(400).json({ error: "No se proporcionaron productos válidos." });
  }

  const promiseDb = connection.promise();
  const conn = await promiseDb.getConnection();

  try {
    await conn.beginTransaction();

    for (const p of productosData) {
      let finalId: number;
      let stockAntes = 0;
      const isServicio = !!p.es_servicio;
      const cantIn = isServicio ? 0 : (p.cantidad || 0);

      if (p.referencia && p.referencia.trim() !== '') {
        const [existing]: any = await conn.query("SELECT id, cantidad FROM productos WHERE empresa_id = ? AND referencia = ? FOR UPDATE", [empresa_id, p.referencia]);
        
        if (existing.length > 0) {
          finalId = existing[0].id;
          stockAntes = existing[0].cantidad;
          const qUpdate = isServicio 
            ? "UPDATE productos SET precio_compra = ?, precio_venta = ?, porcentaje_ganancia = ?, es_servicio = 1, permitir_venta_negativa = ? WHERE id = ? AND empresa_id = ?"
            : "UPDATE productos SET cantidad = cantidad + ?, precio_compra = ?, precio_venta = ?, porcentaje_ganancia = ?, es_servicio = 0, permitir_venta_negativa = ? WHERE id = ? AND empresa_id = ?";
          
          const paramsUpdate = isServicio
            ? [p.precio_compra, p.precio_venta, p.porcentaje_ganancia, p.permitir_venta_negativa !== undefined ? (p.permitir_venta_negativa ? 1 : 0) : 1, finalId, empresa_id]
            : [cantIn, p.precio_compra, p.precio_venta, p.porcentaje_ganancia, p.permitir_venta_negativa !== undefined ? (p.permitir_venta_negativa ? 1 : 0) : 1, finalId, empresa_id];

          await conn.query(qUpdate, paramsUpdate);
        } else {
          const [result]: any = await conn.query(
            "INSERT INTO productos (empresa_id, referencia, nombre, categoria, cantidad, precio_compra, porcentaje_ganancia, precio_venta, es_servicio, permitir_venta_negativa) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [empresa_id, p.referencia || '', p.nombre, p.categoria, cantIn, p.precio_compra, p.porcentaje_ganancia, p.precio_venta, isServicio ? 1 : 0, p.permitir_venta_negativa !== undefined ? (p.permitir_venta_negativa ? 1 : 0) : 1]
          );
          finalId = result.insertId;
        }
      } else {
        const [result]: any = await conn.query(
            "INSERT INTO productos (empresa_id, referencia, nombre, categoria, cantidad, precio_compra, porcentaje_ganancia, precio_venta, es_servicio, permitir_venta_negativa) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [empresa_id, '', p.nombre, p.categoria, cantIn, p.precio_compra, p.porcentaje_ganancia, p.precio_venta, isServicio ? 1 : 0, p.permitir_venta_negativa !== undefined ? (p.permitir_venta_negativa ? 1 : 0) : 1]
          );
          finalId = result.insertId;
      }

      // Registro en Kardex solo si hay movimiento o es cambio relevante (tipo_movimiento dinámico)
      const stockDespues = isServicio ? stockAntes : (stockAntes + cantIn);
      const movKardex = isServicio ? 'INGRESO_SERVICIO_LOTE' : 'ENTRADA_LOTE';

      if (cantIn > 0 || isServicio) {
        await conn.query(
          "INSERT INTO kardex (producto_id, empresa_id, tipo_movimiento, cantidad_antes, cantidad_modificada, cantidad_despues, motivo, usuario_nombre, referencia) VALUES (?, ?, ?, ?, ?, ?, 'Ingreso por Lote / Compra', ?, 'LOTE-BATCH')",
          [finalId, empresa_id, movKardex, stockAntes, cantIn, stockDespues, req.user.username || 'Admin']
        );
      }
    }
    
    await conn.commit();
    res.status(201).json({ message: "Lote guardado y Kardex actualizado con éxito", affectedRows: productosData.length });
  } catch (err) {
    await conn.rollback();
    console.error("Error al procesar lote de productos:", err);
    res.status(500).json({ error: "Error actualizando el inventario por lotes. Los cambios han sido revertidos." });
  } finally {
    conn.release();
  }
});

// Ajuste rápido de inventario (Forzar Nueva Cantidad) + Kardex
router.put("/:id/ajustar", async (req: any, res: any) => {
  const empresa_id = req.user.empresa_id;
  const productoId = req.params.id;
  const { nueva_cantidad, motivo, responsable } = req.body;
  const usuario = responsable || req.user.nombre || "Admin"; 

  if (nueva_cantidad === undefined || isNaN(nueva_cantidad)) {
    return res.status(400).json({ error: "Cantidad no válida proporcionada" });
  }
  if (!motivo) {
    return res.status(400).json({ error: "El motivo del ajuste es obligatorio para el Kardex." });
  }

  const promiseDb = connection.promise();
  const conn = await promiseDb.getConnection();

  try {
    await conn.beginTransaction();

    // 1. Obtener stock actual con bloqueo
    const [stocks]: any = await conn.query("SELECT cantidad FROM productos WHERE id = ? AND empresa_id = ? FOR UPDATE", [productoId, empresa_id]);
    if (stocks.length === 0) throw new Error("Producto no encontrado");
    
    const stock_antes = stocks[0].cantidad;
    const stock_despues = parseInt(nueva_cantidad, 10);
    const diferencia = stock_despues - stock_antes;

    // 2. Actualizar stock
    await conn.query("UPDATE productos SET cantidad = ? WHERE id = ? AND empresa_id = ?", [stock_despues, productoId, empresa_id]);
      
    // 3. Registrar en Kardex
    await conn.query(
      "INSERT INTO kardex (producto_id, empresa_id, tipo_movimiento, cantidad_antes, cantidad_modificada, cantidad_despues, motivo, usuario_nombre) VALUES (?, ?, 'AJUSTE', ?, ?, ?, ?, ?)",
      [productoId, empresa_id, stock_antes, Math.abs(diferencia), stock_despues, motivo, usuario]
    );

    await conn.commit();
    res.json({ success: true, message: "Inventario nivelado y registrado en Kardex correctamente." });
  } catch (err: any) {
    await conn.rollback();
    console.error("Error en ajuste de inventario:", err);
    res.status(500).json({ error: err.message || "No se pudo ajustar el inventario" });
  } finally {
    conn.release();
  }
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

