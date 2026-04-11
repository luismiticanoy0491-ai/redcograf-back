import express from "express";
import connection from "../conection";
import { verifyTokenAndTenant } from "../middlewares/authMiddleware";

const router = express.Router();

// Middleware de seguridad obligatorio
router.use(verifyTokenAndTenant);

// Obtener Kardex filtrado por Tenant
router.get("/", (req: any, res: any) => {
  const { productoId, startDate, endDate, tipo } = req.query;
  const empresa_id = req.user.empresa_id;

  let query = `
    SELECT 
      k.*, 
      IFNULL(p.nombre, '(PRODUCTO ELIMINADO)') as producto_nombre, 
      IFNULL(p.referencia, k.referencia) as codigo_barras
    FROM kardex k
    LEFT JOIN productos p ON k.producto_id = p.id
    WHERE k.empresa_id = ?
  `;
  const params: any[] = [empresa_id];

  if (productoId) {
    query += " AND k.producto_id = ?";
    params.push(productoId);
  }
  if (startDate) {
    query += " AND k.fecha >= ?";
    params.push(startDate);
  }
  if (endDate) {
    query += " AND k.fecha <= ?";
    params.push(`${endDate} 23:59:59`);
  }
  if (tipo) {
    query += " AND k.tipo_movimiento = ?";
    params.push(tipo);
  }

  query += " ORDER BY k.fecha DESC";

  connection.query(query, params, (err: any, results: any) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

export default router;
