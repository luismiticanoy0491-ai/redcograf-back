import express from "express";
import connection from "../conection";
import { verifyTokenAndTenant } from "../middlewares/authMiddleware";

const router = express.Router();

// Blindaje de seguridad y aislamiento por tienda
router.use(verifyTokenAndTenant);

// Obtener datos resumidos para el Dashboard Central (Aislado por empresa)
router.get("/resumen", (req: any, res: any) => {
  const empresa_id = req.user.empresa_id;

  // Query principal filtrada por empresa
  const queryGlobal = `
    SELECT 
      SUM(cantidad * precio_compra) AS total_invertido,
      SUM(cantidad * precio_venta) AS ganancia_proyectada,
      SUM(cantidad) AS total_articulos
    FROM productos
    WHERE empresa_id = ? AND es_servicio = 0;
  `;

  // Categorías filtradas por empresa
  const queryCategorias = `
    SELECT 
      categoria, 
      SUM(cantidad * precio_compra) AS valor_invertido,
      SUM(cantidad * precio_venta) AS valor_venta,
      SUM(cantidad) as cantidad_articulos
    FROM productos
    WHERE empresa_id = ? AND es_servicio = 0
    GROUP BY categoria
    ORDER BY valor_invertido DESC;
  `;

  // Alertas de bajo stock filtradas por empresa
  const queryBajoStock = `
    SELECT id, referencia, nombre, categoria, cantidad 
    FROM productos 
    WHERE empresa_id = ? AND cantidad < 5 AND es_servicio = 0
    ORDER BY cantidad ASC
    LIMIT 20;
  `;

  connection.query(queryGlobal, [empresa_id], (err, resultGlobal: any) => {
    if (err) return res.status(500).json({ error: "Error obteniendo datos globales" });
    
    connection.query(queryCategorias, [empresa_id], (err, resultCategorias: any) => {
      if (err) return res.status(500).json({ error: "Error obteniendo categorías" });
      
      connection.query(queryBajoStock, [empresa_id], (err, resultBajoStock: any) => {
        if (err) return res.status(500).json({ error: "Error obteniendo bajo stock" });
        
        res.json({
          globales: resultGlobal[0] || { total_invertido: 0, ganancia_proyectada: 0, total_articulos: 0 },
          categorias: resultCategorias,
          alertasBajoStock: resultBajoStock
        });
      });
    });
  });
});

export default router;
