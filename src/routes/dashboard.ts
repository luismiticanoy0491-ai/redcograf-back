import express from "express";
import connection from "../conection";

const router = express.Router();

// Obtener datos resumidos para el Dashboard Central
router.get("/resumen", (req, res) => {
  // Query principal para obtener totales
  const queryGlobal = `
    SELECT 
      SUM(cantidad * precio_compra) AS total_invertido,
      SUM(cantidad * precio_venta) AS ganancia_proyectada,
      SUM(cantidad) AS total_articulos
    FROM productos;
  `;

  // Query para obtener desglose de inventario por categoría
  const queryCategorias = `
    SELECT 
      categoria, 
      SUM(cantidad * precio_compra) AS valor_invertido,
      SUM(cantidad) as cantidad_articulos
    FROM productos
    GROUP BY categoria
    ORDER BY valor_invertido DESC;
  `;

  // Query para alertas de bajo stock (< 5)
  const queryBajoStock = `
    SELECT id, referencia, nombre, categoria, cantidad 
    FROM productos 
    WHERE cantidad < 5
    ORDER BY cantidad ASC
    LIMIT 20;
  `;

  connection.query(queryGlobal, (err, resultGlobal) => {
    if (err) return res.status(500).json({ error: "Error obteniendo datos globales" });
    
    connection.query(queryCategorias, (err, resultCategorias) => {
      if (err) return res.status(500).json({ error: "Error obteniendo categorías" });
      
      connection.query(queryBajoStock, (err, resultBajoStock) => {
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
