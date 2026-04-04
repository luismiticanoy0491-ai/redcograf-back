import express from "express";
import connection from "../conection";

const router = express.Router();

// Fetch payroll data for a specific month and year
router.get("/", (req, res) => {
  const { mes, anio } = req.query;
  
  if (!mes || !anio) {
    return res.status(400).json({ error: "Parámetros 'mes' y 'anio' son requeridos." });
  }

  const queryCajeros = `SELECT * FROM cajeros;`;
  const queryVentas = `
    SELECT cajero_id, SUM(total) as total_ventas 
    FROM facturas_venta 
    WHERE MONTH(fecha) = ? AND YEAR(fecha) = ? 
    GROUP BY cajero_id;
  `;
  const queryPagos = `
    SELECT * FROM pagos_empleados 
    WHERE mes = ? AND anio = ?;
  `;

  connection.query(queryCajeros, (err: any, cajeros: any[]) => {
    if (err) return res.status(500).json({ error: err.message });
    
    connection.query(queryVentas, [mes, anio], (err: any, ventas: any[]) => {
      if (err) return res.status(500).json({ error: err.message });

      connection.query(queryPagos, [mes, anio], (err: any, pagos: any[]) => {
        if (err) return res.status(500).json({ error: err.message });

        const nomina = cajeros.map(cajero => {
          const ventaCajero = ventas.find(v => v.cajero_id === cajero.id);
          const totalVentas = ventaCajero ? parseFloat(ventaCajero.total_ventas) : 0;
          
          let comisiones = 0;
          if (cajero.paga_comisiones) {
            comisiones = totalVentas * (parseFloat(cajero.porcentaje_comision) / 100);
          }

          const salario_base = parseFloat(cajero.salario) || 0;
          const total_a_pagar = salario_base + comisiones;

          const pagoRegistrado = pagos.find(p => p.cajero_id === cajero.id);
          const estado = pagoRegistrado ? "Pagado" : "Pendiente";

          return {
            cajero_id: cajero.id,
            nombre: cajero.nombre,
            documento: cajero.documento,
            salario_base,
            totalVentas,
            porcentaje_comision: cajero.porcentaje_comision,
            comisiones,
            total_a_pagar,
            estado,
            fecha_pago: pagoRegistrado ? pagoRegistrado.fecha_pago : null,
            pago_id: pagoRegistrado ? pagoRegistrado.id : null
          };
        });

        res.json(nomina);
      });
    });
  });
});

// Mark payroll as paid
router.post("/", (req, res) => {
  const { cajero_id, mes, anio, salario_base, comisiones, total_pagado, metodo_pago } = req.body;
  
  if (!cajero_id || !mes || !anio) {
    return res.status(400).json({ error: "Faltan datos requeridos." });
  }

  // Check if already paid
  const checkQuery = `SELECT id FROM pagos_empleados WHERE cajero_id = ? AND mes = ? AND anio = ?`;
  connection.query(checkQuery, [cajero_id, mes, anio], (err: any, results: any[]) => {
    if (err) return res.status(500).json({ error: err.message });
    
    if (results.length > 0) {
      return res.status(400).json({ error: "Este empleado ya tiene un pago registrado para ese mes y año." });
    }

    const insertQuery = `
      INSERT INTO pagos_empleados (cajero_id, mes, anio, salario_base, comisiones, total_pagado, metodo_pago)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    connection.query(
      insertQuery,
      [cajero_id, mes, anio, salario_base || 0, comisiones || 0, total_pagado || 0, metodo_pago || 'Efectivo'],
      (err: any, result: any) => {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ success: true, id: result.insertId });
      }
    );
  });
});

export default router;
