import express from "express";
import connection from "../conection";
import { verifyTokenAndTenant } from "../middlewares/authMiddleware";

const router = express.Router();

// Seguridad ante todo
router.use(verifyTokenAndTenant);

router.get("/dashboard", (req: any, res: any) => {
  const empresa_id = req.user.empresa_id;
  const { cajeroId, categoria, startDate, endDate, es_servicio } = req.query;

  const reportes: {
    general: any;
    topProductos: any;
    rendimientoCajeros: any;
    ingresosCategorias: any;
  } = {
    general: null,
    topProductos: null,
    rendimientoCajeros: null,
    ingresosCategorias: null
  };

  // Base where clauses focusing on tenant isolation
  let whereClauses = ["f.empresa_id = ?"];
  let params: any[] = [empresa_id];

  if (cajeroId) {
    whereClauses.push("f.cajero_id = ?");
    params.push(cajeroId);
  }
  if (categoria) {
    whereClauses.push("p.categoria = ?");
    params.push(categoria);
  }
  if (es_servicio !== undefined && es_servicio !== "") {
    whereClauses.push("p.es_servicio = ?");
    params.push(es_servicio === 'true' || es_servicio === '1' ? 1 : 0);
  }
  if (startDate) {
    whereClauses.push("f.fecha >= ?");
    params.push(`${startDate} 00:00:00`);
  }
  if (endDate) {
    whereClauses.push("f.fecha <= ?");
    params.push(`${endDate} 23:59:59`);
  }

  const whereSQL = whereClauses.join(" AND ");

  const q1 = `
    SELECT 
      COALESCE(SUM(factura_total), 0) as total_ingresos, 
      COALESCE(SUM(factura_utilidad), 0) as total_utilidad_global,
      COALESCE(SUM(factura_iva), 0) as total_iva,
      COUNT(DISTINCT factura_id) as total_ventas 
    FROM (
      SELECT 
        f.id as factura_id,
        f.iva as factura_iva,
        SUM(v.cantidad * v.precio_unitario) as factura_total,
        SUM(v.cantidad * (v.precio_unitario - COALESCE(NULLIF(v.costo_unitario, 0), p.precio_compra, 0))) as factura_utilidad
      FROM facturas_venta f
      LEFT JOIN ventas v ON f.id = v.factura_id
      LEFT JOIN productos p ON v.producto_id = p.id
      WHERE ${whereSQL}
      GROUP BY f.id
    ) as sub
  `;
  
  // Q2: TOP PRODUCTOS
  const q2 = `
    SELECT p.nombre, p.categoria, SUM(v.cantidad) as total_vendido 
    FROM facturas_venta f
    JOIN ventas v ON f.id = v.factura_id
    JOIN productos p ON v.producto_id = p.id
    WHERE ${whereSQL}
    GROUP BY p.id
    ORDER BY total_vendido DESC
    LIMIT 5
  `;

  // Q3: RENDIMIENTO CAJEROS (Filtrado Estricto por Categoría y Fecha)
  let q3Params: any[] = [empresa_id];
  let q3WhereClauses = ["f.empresa_id = ?"];

  if (cajeroId) {
    q3WhereClauses.push("f.cajero_id = ?");
    q3Params.push(cajeroId);
  }
  if (startDate) {
    q3WhereClauses.push("f.fecha >= ?");
    q3Params.push(`${startDate} 00:00:00`);
  }
  if (endDate) {
    q3WhereClauses.push("f.fecha <= ?");
    q3Params.push(`${endDate} 23:59:59`);
  }
  if (categoria) {
    q3WhereClauses.push("p.categoria = ?");
    q3Params.push(categoria);
  }

  const q3Where = q3WhereClauses.join(" AND ");

  const q3 = `
    SELECT c.nombre, 
           COUNT(DISTINCT f.id) as cantidad_facturas, 
           COALESCE(SUM(v.cantidad * v.precio_unitario), 0) as dinero_recaudado,
           COALESCE(SUM(CASE WHEN f.metodo_pago = 'Efectivo' THEN (v.cantidad * v.precio_unitario) WHEN f.metodo_pago = 'Mixto' THEN (f.pago_efectivo * (v.cantidad * v.precio_unitario / NULLIF(f.total, 0))) ELSE 0 END), 0) as dinero_efectivo,
           COALESCE(SUM(CASE WHEN f.metodo_pago IN ('Tarjeta', 'Transferencia') THEN (v.cantidad * v.precio_unitario) WHEN f.metodo_pago = 'Mixto' THEN (f.pago_transferencia * (v.cantidad * v.precio_unitario / NULLIF(f.total, 0))) ELSE 0 END), 0) as dinero_transferencia,
           COALESCE(SUM(v.cantidad * (v.precio_unitario - COALESCE(NULLIF(v.costo_unitario, 0), p.precio_compra, 0))), 0) as total_utilidad
    FROM cajeros c
    JOIN facturas_venta f ON c.id = f.cajero_id
    JOIN ventas v ON f.id = v.factura_id
    JOIN productos p ON v.producto_id = p.id
    WHERE ${q3Where}
    GROUP BY c.id
    ORDER BY dinero_recaudado DESC
  `;

  // Q4: INGRESOS Y UTILIDAD POR CATEGORIA
  const q4 = `
    SELECT 
      p.categoria, 
      COALESCE(SUM(v.cantidad * v.precio_unitario), 0) as total_recaudado,
      COALESCE(SUM(v.cantidad * (v.precio_unitario - COALESCE(NULLIF(v.costo_unitario, 0), p.precio_compra, 0))), 0) as total_utilidad
    FROM facturas_venta f
    JOIN ventas v ON f.id = v.factura_id
    JOIN productos p ON v.producto_id = p.id
    WHERE ${whereSQL}
    GROUP BY p.categoria
    ORDER BY total_recaudado DESC
  `;

  const runQuery = (query: string, queryParams: any[]) => {
    return new Promise((resolve, reject) => {
      connection.query(query, queryParams, (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
  };

  Promise.all([
    runQuery(q1, params),
    runQuery(q2, params),
    runQuery(q3, q3Params),
    runQuery(q4, params)
  ])
  .then(([res1, res2, res3, res4]: any) => {
    reportes.general = res1[0];
    reportes.topProductos = res2;
    reportes.rendimientoCajeros = res3;
    reportes.ingresosCategorias = res4;
    res.json(reportes);
  })
  .catch(err => {
    console.error("Analytics Error:", err);
    res.status(500).json({ error: "Error procesando analíticas" });
  });
});

// --- NUEVO: OBTENER CATEGORÍAS QUE TIENEN VENTAS REGISTRADAS ---
router.get("/categorias-vendidas", (req: any, res: any) => {
  const empresa_id = req.user.empresa_id;
  const { cajeroId, startDate, endDate, es_servicio } = req.query;

  let whereClauses = ["f.empresa_id = ?"];
  let params: any[] = [empresa_id];

  if (cajeroId) {
    whereClauses.push("f.cajero_id = ?");
    params.push(cajeroId);
  }
  if (es_servicio !== undefined && es_servicio !== "") {
    whereClauses.push("p.es_servicio = ?");
    params.push(es_servicio === 'true' || es_servicio === '1' ? 1 : 0);
  }
  if (startDate) {
    whereClauses.push("f.fecha >= ?");
    params.push(`${startDate} 00:00:00`);
  }
  if (endDate) {
    whereClauses.push("f.fecha <= ?");
    params.push(`${endDate} 23:59:59`);
  }

  const whereSQL = whereClauses.join(" AND ");

  const query = `
    SELECT DISTINCT p.categoria
    FROM productos p
    JOIN ventas v ON p.id = v.producto_id
    JOIN facturas_venta f ON v.factura_id = f.id
    WHERE ${whereSQL} AND p.categoria IS NOT NULL AND p.categoria != ''
    ORDER BY p.categoria ASC
  `;

  connection.query(query, params, (err, results: any) => {
    if (err) {
      console.error("Error fetching sold categories:", err);
      return res.status(500).json({ error: "Error al obtener categorías con ventas" });
    }
    const categorias = results.map((r: any) => r.categoria);
    res.json(categorias);
  });
});

// --- NUEVO REPORTE DETALLADO DE PRODUCTOS VENDIDOS ---
router.get("/productos-vendidos", (req: any, res: any) => {
  const empresa_id = req.user.empresa_id;
  const { cajeroId, categoria, startDate, endDate, es_servicio, page = 1, limit = 10 } = req.query;
  
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let whereClauses = ["f.empresa_id = ?"];
  let params: any[] = [empresa_id];

  if (cajeroId) {
    whereClauses.push("f.cajero_id = ?");
    params.push(cajeroId);
  }
  if (categoria) {
    whereClauses.push("p.categoria = ?");
    params.push(categoria);
  }
  if (es_servicio !== undefined && es_servicio !== "") {
    whereClauses.push("p.es_servicio = ?");
    params.push(es_servicio === 'true' || es_servicio === '1' ? 1 : 0);
  }
  if (startDate) {
    whereClauses.push("f.fecha >= ?");
    params.push(`${startDate} 00:00:00`);
  }
  if (endDate) {
    whereClauses.push("f.fecha <= ?");
    params.push(`${endDate} 23:59:59`);
  }

  const whereSQL = whereClauses.join(" AND ");

  // Query for paginated data
  const queryData = `
    SELECT 
      v.id as venta_id,
      f.id as factura_id,
      f.fecha,
      c.nombre as cajero,
      p.nombre as producto,
      p.categoria as categoria,
      v.cantidad,
      v.precio_unitario,
      v.comision,
      cl.nombre as cliente,
      f.cliente_id,
      (v.cantidad * v.precio_unitario) as subtotal,
      (v.cantidad * (v.precio_unitario - COALESCE(NULLIF(v.costo_unitario, 0), p.precio_compra, 0))) as utilidad
    FROM ventas v
    JOIN facturas_venta f ON v.factura_id = f.id
    JOIN productos p ON v.producto_id = p.id
    JOIN cajeros c ON f.cajero_id = c.id
    LEFT JOIN clientes cl ON f.cliente_id = cl.id
    WHERE ${whereSQL}
    ORDER BY f.fecha DESC
    LIMIT ? OFFSET ?
  `;

  // Query for total count
  const queryCount = `
    SELECT COUNT(*) as total
    FROM ventas v
    JOIN facturas_venta f ON v.factura_id = f.id
    JOIN productos p ON v.producto_id = p.id
    WHERE ${whereSQL}
  `;

  const runQuery = (query: string, queryParams: any[]) => {
    return new Promise((resolve, reject) => {
      connection.query(query, queryParams, (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
  };

  Promise.all([
    runQuery(queryData, [...params, parseInt(limit), offset]),
    runQuery(queryCount, params)
  ])
  .then(([data, count]: any) => {
    res.json({
      data,
      total: count[0].total,
      page: parseInt(page),
      last_page: Math.ceil(count[0].total / parseInt(limit))
    });
  })
  .catch(err => {
    console.error("Sold Products Report Error:", err);
    res.status(500).json({ error: "Error al generar reporte de productos" });
  });
});

// --- REPORTE DE PRODUCTOS PRÓXIMOS A VENCER (IA PREDICTIVA) ---
router.get("/proximos-vencer", (req: any, res: any) => {
  const empresa_id = req.user.empresa_id;
  
  // Seleccionamos productos con fecha de vencimiento en los próximos 30 días
  const query = `
    SELECT id, nombre, referencia, categoria, cantidad, fecha_vencimiento,
           DATEDIFF(fecha_vencimiento, CURDATE()) as dias_faltantes
    FROM productos
    WHERE empresa_id = ? 
      AND fecha_vencimiento IS NOT NULL 
      AND fecha_vencimiento >= CURDATE()
      AND fecha_vencimiento <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)
    ORDER BY fecha_vencimiento ASC
  `;

  connection.query(query, [empresa_id], (err, results) => {
    if (err) {
      console.error("Error fetching near expiry products:", err);
      return res.status(500).json({ error: "Error al obtener productos por vencer" });
    }
    res.json(results);
  });
});

import ExcelJS from "exceljs";

// --- EXPORTAR REPORTE COMPLETO A EXCEL (.XLSX) ---
router.get("/exportar-excel", (req: any, res: any) => {
  const empresa_id = req.user.empresa_id;
  const { cajeroId, categoria, startDate, endDate } = req.query;

  let whereClauses = ["f.empresa_id = ?"];
  let params: any[] = [empresa_id];

  if (cajeroId) {
    whereClauses.push("f.cajero_id = ?");
    params.push(cajeroId);
  }
  if (categoria) {
    whereClauses.push("p.categoria = ?");
    params.push(categoria);
  }
  if (startDate) {
    whereClauses.push("f.fecha >= ?");
    params.push(`${startDate} 00:00:00`);
  }
  if (endDate) {
    whereClauses.push("f.fecha <= ?");
    params.push(`${endDate} 23:59:59`);
  }

  const whereSQL = whereClauses.join(" AND ");

  const queryExcel = `
    SELECT 
      f.id as FACTURA,
      DATE_FORMAT(f.fecha, '%Y-%m-%d %H:%i') as FECHA,
      c.nombre as CAJERO,
      p.nombre as PRODUCTO,
      IF(f.cliente_id = 1, 'Mostrador / General', cl.nombre) as CLIENTE,
      p.categoria as CATEGORIA,
      v.cantidad as CANTIDAD,
      v.precio_unitario as PRECIO_U,
      v.comision as COMISION,
      (v.cantidad * v.precio_unitario) as TOTAL_RECAUDADO,
      (v.cantidad * (v.precio_unitario - COALESCE(NULLIF(v.costo_unitario, 0), p.precio_compra, 0))) as UTILIDAD
    FROM ventas v
    JOIN facturas_venta f ON v.factura_id = f.id
    JOIN productos p ON v.producto_id = p.id
    JOIN cajeros c ON f.cajero_id = c.id
    LEFT JOIN clientes cl ON f.cliente_id = cl.id
    WHERE ${whereSQL}
    ORDER BY f.fecha DESC
  `;

  connection.query(queryExcel, params, async (err, results: any) => {
    if (err) return res.status(500).json({ error: "Error al exportar" });
    if (results.length === 0) return res.status(404).json({ error: "No hay datos para exportar" });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Reporte de Ventas");

    // Definir columnas con estilos
    worksheet.columns = [
      { header: "FACTURA #", key: "FACTURA", width: 12 },
      { header: "FECHA", key: "FECHA", width: 22 },
      { header: "CAJERO", key: "CAJERO", width: 25 },
      { header: "PRODUCTO", key: "PRODUCTO", width: 40 },
      { header: "CLIENTE", key: "CLIENTE", width: 25 },
      { header: "CATEGORÍA", key: "CATEGORIA", width: 20 },
      { header: "CANTIDAD", key: "CANTIDAD", width: 12 },
      { header: "PRECIO UNIT.", key: "PRECIO_U", width: 15 },
      { header: "COMISIÓN ($)", key: "COMISION", width: 15 },
      { header: "TOTAL RECAUDADO", key: "TOTAL_RECAUDADO", width: 18 },
      { header: "UTILIDAD NETA", key: "UTILIDAD", width: 18 },
    ];

    // Estilo para el encabezado
    worksheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    worksheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF4F46E5" }, // Indigo 600
    };
    worksheet.getRow(1).alignment = { vertical: "middle", horizontal: "center" };

    // Agregar filas
    results.forEach((row: any) => {
      worksheet.addRow(row);
    });

    // Formatear columnas de dinero
    ["H", "I", "J", "K"].forEach(col => {
      worksheet.getColumn(col).numFmt = '"$"#,##0';
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=Reporte_Ventas_Impulsa.xlsx"
    );

    await workbook.xlsx.write(res);
    res.end();
  });
});

export default router;
export {};

