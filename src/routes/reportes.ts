import express from "express";
import connection from "../conection";

const router = express.Router();

router.get("/dashboard", (req, res) => {
  const { cajeroId, categoria, startDate, endDate } = req.query;
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

  let whereClauses = ["1=1"];
  let params = [];

  if (cajeroId) {
    whereClauses.push("f.cajero_id = ?");
    params.push(cajeroId);
  }
  if (categoria) {
    whereClauses.push("p.categoria = ?");
    params.push(categoria);
  }
  if (startDate) {
    whereClauses.push("DATE(f.fecha) >= ?");
    params.push(startDate);
  }
  if (endDate) {
    whereClauses.push("DATE(f.fecha) <= ?");
    params.push(endDate);
  }

  const whereSQL = whereClauses.join(" AND ");

  const q1 = `
    SELECT 
      COALESCE(SUM(v.cantidad * v.precio_unitario), 0) as total_ingresos, 
      COUNT(DISTINCT f.id) as total_ventas 
    FROM facturas_venta f
    LEFT JOIN ventas v ON f.id = v.factura_id
    LEFT JOIN productos p ON v.producto_id = p.id
    WHERE ${whereSQL}
  `;
  
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

  // Para el ranking de cajeros, el LEFT JOIN desde cajeros es vital para mostrarlos a todos,
  // pero aplicar el WHERE de p.categoria directamente anulará a los cajeros que no vendieron eso.
  // Por ende, filtramos las ventas en la unión.
  
  let q3Params = [];
  if (categoria) {
    q3Params.push(categoria); // for the LEFT JOIN
  }

  let q3WhereClauses = ["1=1"];
  if (cajeroId) {
    q3WhereClauses.push("c.id = ?");
    q3Params.push(cajeroId);
  }
  if (startDate) {
    q3WhereClauses.push("DATE(f.fecha) >= ?");
    q3Params.push(startDate);
  }
  if (endDate) {
    q3WhereClauses.push("DATE(f.fecha) <= ?");
    q3Params.push(endDate);
  }
  
  const q3Where = "WHERE " + q3WhereClauses.join(" AND ");

  const q3 = `
    SELECT c.nombre, 
           COUNT(DISTINCT f.id) as cantidad_facturas, 
           COALESCE(SUM(v.cantidad * v.precio_unitario), 0) as dinero_recaudado,
           COALESCE(SUM(CASE WHEN f.metodo_pago = 'Efectivo' THEN (v.cantidad * v.precio_unitario) ELSE 0 END), 0) as dinero_efectivo,
           COALESCE(SUM(CASE WHEN f.metodo_pago != 'Efectivo' AND f.metodo_pago IS NOT NULL THEN (v.cantidad * v.precio_unitario) ELSE 0 END), 0) as dinero_transferencia
    FROM cajeros c
    LEFT JOIN facturas_venta f ON c.id = f.cajero_id
    LEFT JOIN ventas v ON f.id = v.factura_id
    LEFT JOIN productos p ON v.producto_id = p.id ${categoria ? "AND p.categoria = ?" : ""}
    ${q3Where}
    GROUP BY c.id
    ORDER BY dinero_recaudado DESC
  `;

  const q4 = `
    SELECT p.categoria, COALESCE(SUM(v.cantidad * v.precio_unitario), 0) as total_recaudado
    FROM facturas_venta f
    JOIN ventas v ON f.id = v.factura_id
    JOIN productos p ON v.producto_id = p.id
    WHERE ${whereSQL}
    GROUP BY p.categoria
    ORDER BY total_recaudado DESC
  `;

  // Multipromise execution for cleaner flow
  const runQuery = (query, params) => {
    return new Promise((resolve, reject) => {
      connection.query(query, params, (err, results) => {
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
  .then(([res1, res2, res3, res4]) => {
    reportes.general = res1[0];
    reportes.topProductos = res2;
    reportes.rendimientoCajeros = res3;
    reportes.ingresosCategorias = res4;
    res.json(reportes);
  })
  .catch(err => {
    console.error(err);
    res.status(500).json({ error: "Error procesando analíticas" });
  });
});

export default router;
export {};
