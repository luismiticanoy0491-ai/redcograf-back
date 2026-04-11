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

  // Q1: Resumen General
  const q1 = `
    SELECT 
      COALESCE(SUM(v.cantidad * v.precio_unitario), 0) as total_ingresos, 
      COALESCE(SUM(v.cantidad * (v.precio_unitario - COALESCE(NULLIF(v.costo_unitario, 0), p.precio_compra, 0))), 0) as total_utilidad_global,
      COUNT(DISTINCT f.id) as total_ventas 
    FROM facturas_venta f
    LEFT JOIN ventas v ON f.id = v.factura_id
    LEFT JOIN productos p ON v.producto_id = p.id
    WHERE ${whereSQL}
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

export default router;
export {};
