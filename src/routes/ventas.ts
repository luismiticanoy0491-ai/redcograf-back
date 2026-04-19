import express from "express";
import pool from "../conection";
import { verifyTokenAndTenant } from "../middlewares/authMiddleware";

const router = express.Router();

// Middleware de seguridad
router.use(verifyTokenAndTenant);

router.post("/", async (req: any, res: any) => {
  const empresa_id = req.user.empresa_id;
  const { items, metodoPago, cajeroId, clienteId, total, iva, efectivoEntregado, transferenciaEntregada, vuelto } = req.body;
  
  if (!items || items.length === 0) return res.status(400).json({ error: "Carrito vacío" });

  const promisePool = pool.promise();
  let conn;

  try {
    conn = await promisePool.getConnection();
    await conn.beginTransaction();

    // 0. Consultar configuración específica de la empresa
    const [configs]: any = await conn.query(
      "SELECT permitir_venta_negativa FROM empresa_config WHERE empresa_id = ?", 
      [empresa_id]
    );
    const permitirNegativoGlobal = configs && configs[0] ? !!configs[0].permitir_venta_negativa : true;

    // Priorizamos el cajero_id del token (usuario logueado) para evitar selección manual errónea
    const cId = req.user.cajero_id || ((cajeroId && !isNaN(parseInt(cajeroId))) ? parseInt(cajeroId) : null);
    const clId = (clienteId && !isNaN(parseInt(clienteId))) ? parseInt(clienteId) : null;

    // --- NUEVO: Obtener porcentaje de comisión del cajero para desglose itemizado ---
    let percComision = 0;
    if (cId) {
      const [cData]: any = await conn.query("SELECT paga_comisiones, porcentaje_comision FROM cajeros WHERE id = ?", [cId]);
      if (cData.length > 0 && cData[0].paga_comisiones) {
        percComision = parseFloat(cData[0].porcentaje_comision) || 0;
      }
    }
    
    // Cálculo de ingreso neto real en efectivo (restando el vuelto)
    const vlt = parseFloat(vuelto) || 0;
    const pefRaw = parseFloat(efectivoEntregado) || 0;
    const pef = Math.max(0, pefRaw - vlt); 
    const ptr = parseFloat(transferenciaEntregada) || 0;
    const ivaVal = Math.round((parseFloat(iva) || 0) * 100) / 100;
    const totalVal = Math.round((parseFloat(total) || 0) * 100) / 100;

    // 1. Insertar Cabecera de Factura
    const [resCab]: any = await conn.query(
      "INSERT INTO facturas_venta (empresa_id, cajero_id, cliente_id, total, iva, metodo_pago, pago_efectivo, pago_transferencia) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [empresa_id, cId, clId, totalVal, ivaVal, metodoPago, pef, ptr]
    );
    const facturaId = resCab.insertId;

    // 2. Insertar Detalles y Actualizar Inventario
    for (const item of items) {
      if (!item.id || !item.qty) {
        throw new Error("Datos de producto inválidos en el carrito.");
      }

      // Validar stock antes de vender (si no es servicio y no se permite negativo)
      const [prodData]: any = await conn.query(
        "SELECT cantidad, es_servicio, permitir_venta_negativa, precio_compra, nombre FROM productos WHERE id = ? AND empresa_id = ?",
        [item.id, empresa_id]
      );

      if (prodData.length === 0) {
        throw new Error(`Producto ${item.id} no encontrado.`);
      }

      const producto = prodData[0];
      const permitirNegativoProd = !!producto.permitir_venta_negativa;
      const stockDisponible = producto.cantidad;
      const esServicio = !!producto.es_servicio;

      // Solo bloquear si no es servicio Y no se permite negativo (global o por producto)
      if (!esServicio && !permitirNegativoGlobal && !permitirNegativoProd) {
        if (stockDisponible < item.qty) {
          throw new Error(`Stock insuficiente para: ${producto.nombre}. Disponible: ${stockDisponible}`);
        }
      }

      // --- CÁLCULO DE COMISIÓN ITEMIZADA ---
      const subtotalItem = item.precio_venta * item.qty;
      const comisionItem = Math.round((subtotalItem * (percComision / 100)) * 100) / 100;

      // Insertar detalle de venta con comisión calculada
      await conn.query(
        "INSERT INTO ventas (empresa_id, factura_id, producto_id, cantidad, precio_unitario, costo_unitario, comision) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [empresa_id, facturaId, item.id, item.qty, item.precio_venta, producto.precio_compra || 0, comisionItem]
      );

      // Actualizar Stock (Restar para productos, Sumar para servicios como acumulador de uso si fuera necesario, pero aquí restamos por defecto)
      // Ajuste: Para servicios, generalmente no se resta stock físico, pero el sistema puede llevar un conteo.
      const stockChange = esServicio ? 0 : item.qty;
      if (stockChange !== 0) {
        await conn.query(
          "UPDATE productos SET cantidad = cantidad - ? WHERE id = ? AND empresa_id = ?",
          [stockChange, item.id, empresa_id]
        );

        // Registrar en Kardex
        const usuario_venta = req.user.username || 'Cajero';
        await conn.query(
          "INSERT INTO kardex (empresa_id, producto_id, tipo_movimiento, cantidad_antes, cantidad_modificada, cantidad_despues, motivo, usuario_nombre, referencia) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
          [
            empresa_id, 
            item.id, 
            'SALIDA', 
            stockDisponible, 
            -item.qty, 
            stockDisponible - item.qty, 
            `Venta POS / Factura: ${facturaId}`, 
            usuario_venta, 
            `FAC-${facturaId}`
          ]
        );
      }
    }

    await conn.commit();
    res.status(201).json({ success: true, factura_id: facturaId });

  } catch (error: any) {
    if (conn) await conn.rollback();
    console.error("Error en procesamiento de venta:", error);
    res.status(500).json({ error: error.message || "Error al procesar la venta" });
  } finally {
    if (conn) conn.release();
  }
});

router.get("/", (req: any, res: any) => {
  const empresa_id = req.user.empresa_id;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const offset = (page - 1) * limit;
  const search = req.query.search as string || "";
  const filtro = req.query.filtro as string || "Todas";

  let whereClause = "WHERE f.empresa_id = ?";
  const queryParams: any[] = [empresa_id];

  if (search) {
    whereClause += " AND (cl.nombre LIKE ? OR f.id LIKE ?)";
    const searchPattern = `%${search}%`;
    queryParams.push(searchPattern, searchPattern);
  }

  if (filtro === "Efectivo") {
    whereClause += " AND f.metodo_pago = 'Efectivo'";
  } else if (filtro === "Transferencia") {
    whereClause += " AND f.metodo_pago = 'Transferencia'";
  }

  const countQuery = `
    SELECT COUNT(*) as total 
    FROM facturas_venta f
    LEFT JOIN clientes cl ON f.cliente_id = cl.id
    ${whereClause}
  `;

  const dataQuery = `
    SELECT f.id, f.fecha, f.total, f.iva, f.metodo_pago, f.pago_efectivo, f.pago_transferencia, f.cliente_id, c.nombre AS cajero, cl.nombre AS cliente, cl.telefono 
    FROM facturas_venta f
    LEFT JOIN cajeros c ON f.cajero_id = c.id
    LEFT JOIN clientes cl ON f.cliente_id = cl.id
    ${whereClause}
    ORDER BY f.fecha DESC
    LIMIT ? OFFSET ?
  `;

  pool.query(countQuery, queryParams, (err: any, countRes: any) => {
    if (err) return res.status(500).json({ error: err.message });
    const total = countRes[0].total;

    pool.query(dataQuery, [...queryParams, limit, offset], (err: any, results: any) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({
        data: results,
        total: total,
        page: page,
        last_page: Math.ceil(total / limit)
      });
    });
  });
});

router.get("/:id", (req: any, res: any) => {
  const empresa_id = req.user.empresa_id;
  const query = `
    SELECT v.cantidad, v.precio_unitario, p.nombre, p.referencia 
    FROM ventas v
    JOIN productos p ON v.producto_id = p.id
    WHERE v.factura_id = ? AND v.empresa_id = ?
  `;
  pool.query(query, [req.params.id, empresa_id], (err: any, results: any) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

router.delete("/:id", async (req: any, res: any) => {
  const empresa_id = req.user.empresa_id;
  const facturaId = req.params.id;
  const { motivo_anulacion, usuario_nombre } = req.body || {};
  const auditor_nombre = usuario_nombre || req.user.username || 'System';

  const promisePool = pool.promise();
  const conn = await promisePool.getConnection();

  try {
    await conn.beginTransaction();

    // 1. Obtener los ítems de la venta para devolver stock
    const [items]: any = await conn.query(
      "SELECT producto_id, cantidad FROM ventas WHERE factura_id = ? AND empresa_id = ? FOR UPDATE", 
      [facturaId, empresa_id]
    );

    if (items.length > 0) {
      for (const item of items) {
        // Consultar tipo de producto (bloqueado para evitar colisiones)
        const [pData]: any = await conn.query("SELECT es_servicio, cantidad FROM productos WHERE id = ? FOR UPDATE", [item.producto_id]);
        
        if (pData.length > 0) {
          const esServicio = !!pData[0].es_servicio;
          const stock_antes = pData[0].cantidad;

          if (!esServicio) {
            // Revertir stock solo si era producto físico
            await conn.query("UPDATE productos SET cantidad = cantidad + ? WHERE id = ? AND empresa_id = ?", [item.cantidad, item.producto_id, empresa_id]);
          }

          // Registrar en Kardex la anulación para trazabilidad
          // Si era servicio, el stock no cambia
          const stock_despues = esServicio ? stock_antes : (stock_antes + item.cantidad);
          const movType = esServicio ? 'ANULACIÓN_SERVICIO' : 'ANULACIÓN';
          await conn.query(
            "INSERT INTO kardex (producto_id, empresa_id, tipo_movimiento, cantidad_antes, cantidad_modificada, cantidad_despues, motivo, usuario_nombre, referencia) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [item.producto_id, empresa_id, movType, stock_antes, item.cantidad, stock_despues, `Anulación: ${motivo_anulacion || 'Sin motivo'}`, auditor_nombre, `F-${facturaId}-ANUL`]
          );
        }
      }
    }

    // 2. Eliminar detalles y cabecera
    await conn.query("DELETE FROM ventas WHERE factura_id = ? AND empresa_id = ?", [facturaId, empresa_id]);
    await conn.query("DELETE FROM facturas_venta WHERE id = ? AND empresa_id = ?", [facturaId, empresa_id]);

    await conn.commit();
    res.json({ success: true, message: "Factura anulada y stock devuelto con trazabilidad en Kardex." });

  } catch (error: any) {
    await conn.rollback();
    console.error("Error al anular factura:", error);
    res.status(500).json({ error: "No se pudo anular la factura: " + error.message });
  } finally {
    conn.release();
  }
});

export default router;

