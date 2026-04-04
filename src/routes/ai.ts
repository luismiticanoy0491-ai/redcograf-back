const express = require("express");
const router = express.Router();
const connection = require("../conection");

// Ruta para generar predicciones y análisis estadísticos
router.get("/predicciones", async (req, res) => {
  try {
    const promiseDb = connection.promise();
    // 1. Obtener todas las ventas históricas de productos agrupadas por mes y año
    const query = `
      SELECT 
        v.producto_id,
        p.nombre,
        p.categoria,
        p.cantidad AS stock_actual,
        DATE_FORMAT(f.fecha, '%Y-%m') AS mes,
        SUM(v.cantidad) AS total_vendido
      FROM ventas v
      JOIN facturas_venta f ON v.factura_id = f.id
      JOIN productos p ON v.producto_id = p.id
      GROUP BY v.producto_id, p.nombre, p.categoria, p.cantidad, mes
      ORDER BY mes ASC
    `;
    const [rows] = await promiseDb.query(query);

    // 2. Procesar y normalizar los datos para cada producto específico
    const authData: Record<string, {
      id: number;
      nombre: string;
      categoria: string;
      stock_actual: number;
      historia: { mes: string; cantidad: number }[];
      sum_ventas: number;
    }> = {};
    rows.forEach(row => {
      const { producto_id, nombre, categoria, stock_actual, mes, total_vendido } = row;
      if (!authData[producto_id]) {
        authData[producto_id] = { id: producto_id, nombre, categoria, stock_actual, historia: [], sum_ventas: 0 };
      }
      authData[producto_id].historia.push({ mes, cantidad: Number(total_vendido) });
      authData[producto_id].sum_ventas += Number(total_vendido);
    });

    // 3. Motor Estadístico - Ponderaciones de Inventario
    const recomendaciones = [];
    const graficaMensual: Record<string, { mes: string; total_unidades_reales: number; prediccion_proyectada?: number }> = {};

    Object.values(authData).forEach(prod => {
      // Sumar los volúmenes globales para el gráfico macroscópico del negocio
      prod.historia.forEach(h => {
        if (!graficaMensual[h.mes]) graficaMensual[h.mes] = { mes: h.mes, total_unidades_reales: 0 };
        graficaMensual[h.mes].total_unidades_reales += h.cantidad;
      });

      // Cálculo de predicción (Matemática Ponderada por Tendencia) para este producto
      let prediccion_mes_siguiente = 0;
      
      if (prod.historia.length >= 2) {
        // Existe tendencia en una línea de tiempo (mínimo 2 meses)
        const ult = prod.historia[prod.historia.length - 1].cantidad;
        const penult = prod.historia[prod.historia.length - 2].cantidad;
        const tendencia = ult - penult;
        
        let avg = prod.sum_ventas / prod.historia.length;
        // Pondera el último mes (60%) y el promedio global (40%) sumando la inercia (tendencia)
        prediccion_mes_siguiente = Math.round((ult * 0.6) + (avg * 0.4) + (tendencia * 0.5));
      } else if (prod.historia.length === 1) {
        // Solo un registro existe (Venta debut)
        const ult = prod.historia[0].cantidad;
        prediccion_mes_siguiente = Math.round(ult * 1.05); // Crecimiento base plano del 5%
      }

      if (prediccion_mes_siguiente < 0) prediccion_mes_siguiente = 0; // Prevenir desbalances absurdos
      
      // La Inteligencia resta y deduce el hueco o brecha comercial contra el almacén físico actual
      let sugerencia_compra = prediccion_mes_siguiente - prod.stock_actual;
      let status = "✅ Óptimo";
      
      if (sugerencia_compra > 0) {
        status = "⚠️ Pedir Urgente";
      } else {
        sugerencia_compra = 0;
        // Si tienes el doble de piezas guardadas de lo que vas a vender el próximo mes, es inventario congelado
        if (prod.stock_actual >= prediccion_mes_siguiente * 2) {
          status = "🧊 Dinero Estancado";
        }
      }

      recomendaciones.push({
        id: prod.id,
        nombre: prod.nombre,
        categoria: prod.categoria,
        stock_actual: prod.stock_actual,
        vendido_historico: prod.sum_ventas,
        meses_con_ventas: prod.historia.length,
        prediccion_proximo_mes: prediccion_mes_siguiente,
        sugerencia_compra: sugerencia_compra,
        status: status
      });
    });

    // Ordenamos la tabla maestra priorizando los productos que se van a agotar más rápido
    recomendaciones.sort((a, b) => b.sugerencia_compra - a.sugerencia_compra);

    // 4. Interpolación de la Gráfica Visual Predictiva (Macro)
    const graficaType = { mes: "", total_unidades_reales: 0, prediccion_proyectada: 0 };
    type GraficaType = typeof graficaType;
    let dataGrafica: (GraficaType | { mes: string; total_unidades_reales: number; prediccion_proyectada?: number })[] = Object.values(graficaMensual).sort((a, b) => a.mes.localeCompare(b.mes));
    const sumaPrediccionesGlobales = recomendaciones.reduce((acc, curr) => acc + curr.prediccion_proximo_mes, 0);
    
    if (dataGrafica.length > 0) {
      // Añadir la variable "es_prediccion" a la última fecha real para que conecte la línea
      dataGrafica[dataGrafica.length - 1].prediccion_proyectada = dataGrafica[dataGrafica.length - 1].total_unidades_reales;

      // Generar el mes artificial estadístico al futuro y ligarlo
      const ultimoMesString = dataGrafica[dataGrafica.length - 1].mes;
      let d = new Date(ultimoMesString + "-01");
      d.setMonth(d.getMonth() + 1);
      const nextMonthStr = d.toISOString().slice(0, 7) + " (Proyección AI)";
      
      dataGrafica.push({
        mes: nextMonthStr,
        total_unidades_reales: 0,
        prediccion_proyectada: sumaPrediccionesGlobales
      });
    }

    res.json({
      tendenciaGeneral: dataGrafica,
      rankingIA: recomendaciones
    });

  } catch (err) {
    console.error("Error en motor ML Predictivo:", err);
    res.status(500).json({ error: "Fallo calculando algoritmos de decisión estadística." });
  }
});

module.exports = router;

export {};
