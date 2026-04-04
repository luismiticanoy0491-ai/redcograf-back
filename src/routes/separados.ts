import express from "express";
import connection from "../conection";
import { verifyTokenAndTenant } from "../middlewares/authMiddleware";

const router = express.Router();

// Middleware de seguridad
router.use(verifyTokenAndTenant);

// GET all separados
router.get("/", (req: any, res: any) => {
  const empresa_id = req.user.empresa_id;
  const sql = `
    SELECT s.*, c.nombre as cliente_nombre, c.documento as cliente_documento 
    FROM separados s
    LEFT JOIN clientes c ON s.cliente_id = c.id
    WHERE s.empresa_id = ?
    ORDER BY s.fecha_creacion DESC
  `;
  connection.query(sql, [empresa_id], (err: any, results: any) => {
    if (err) return res.status(500).json({ error: "Error obteniendo separados" });
    res.json(results);
  });
});

// GET one separado and its abonos
router.get("/:id", (req: any, res: any) => {
  const empresa_id = req.user.empresa_id;
  const { id } = req.params;
  connection.query(`
    SELECT s.*, c.nombre as cliente_nombre, c.documento as cliente_documento 
    FROM separados s 
    LEFT JOIN clientes c ON s.cliente_id = c.id 
    WHERE s.id = ? AND s.empresa_id = ?
  `, [id, empresa_id], (err: any, sepRes: any) => {
    if (err || sepRes.length === 0) return res.status(404).json({ error: "No encontrado" });
    
    connection.query("SELECT * FROM abonos_separados WHERE separado_id = ? AND empresa_id = ? ORDER BY fecha_abono ASC", [id, empresa_id], (err2: any, abonosRes: any) => {
      res.json({
        separado: sepRes[0],
        abonos: abonosRes || []
      });
    });
  });
});

// POST new separado
router.post("/", (req: any, res: any) => {
  const empresa_id = req.user.empresa_id;
  const { cliente_id, detalles, total, abono_inicial } = req.body;
  
  if (!cliente_id || !detalles || total === undefined) {
    return res.status(400).json({ error: "Faltan datos" });
  }

  const saldo_pendiente = total - (abono_inicial || 0);

  const sql = `INSERT INTO separados (empresa_id, cliente_id, total, saldo_pendiente, detalles_json) VALUES (?, ?, ?, ?, ?)`;
  connection.query(sql, [empresa_id, cliente_id, total, saldo_pendiente, JSON.stringify(detalles)], (err: any, result: any) => {
    if (err) return res.status(500).json({ error: "Error creando separado: " + err.message });
    
    const separadoId = result.insertId;
    
    if (abono_inicial && abono_inicial > 0) {
      const sqlAbono = `INSERT INTO abonos_separados (empresa_id, separado_id, monto) VALUES (?, ?, ?)`;
      connection.query(sqlAbono, [empresa_id, separadoId, abono_inicial], () => {
        res.json({ success: true, message: "Separado creado con abono", separado_id: separadoId });
      });
    } else {
      res.json({ success: true, message: "Separado creado", separado_id: separadoId });
    }
  });
});

// POST abono a separado
router.post("/:id/abonos", (req: any, res: any) => {
  const empresa_id = req.user.empresa_id;
  const { id } = req.params;
  const { monto } = req.body;
  if (!monto || monto <= 0) return res.status(400).json({ error: "Monto inválido" });

  connection.query("SELECT saldo_pendiente, estado FROM separados WHERE id = ? AND empresa_id = ?", [id, empresa_id], (err: any, results: any) => {
    if (err || results.length === 0) return res.status(404).json({ error: "Separado no encontrado" });
    
    let { saldo_pendiente, estado } = results[0];
    if (estado !== "Pendiente") return res.status(400).json({ error: "El separado ya está " + estado });
    if (monto > saldo_pendiente) return res.status(400).json({ error: "El monto supera el saldo pendiente" });
    
    const nuevo_saldo = saldo_pendiente - monto;
    
    connection.query("INSERT INTO abonos_separados (empresa_id, separado_id, monto) VALUES (?, ?, ?)", [empresa_id, id, monto], (err1: any) => {
      if (err1) return res.status(500).json({ error: "Error insertando abono" });
      
      connection.query("UPDATE separados SET saldo_pendiente = ? WHERE id = ? AND empresa_id = ?", [nuevo_saldo, id, empresa_id], (err2: any) => {
         if (err2) return res.status(500).json({ error: "Error actualizando saldo" });
         res.json({ success: true, message: "Abono registrado correctamente", nuevo_saldo });
      });
    });
  });
});

// PUT completar separado (convertir a venta)
router.put("/:id/completar", (req: any, res: any) => {
  const empresa_id = req.user.empresa_id;
  const { id } = req.params;
  const { cajero_id, metodo_pago } = req.body; 

  connection.query("SELECT * FROM separados WHERE id = ? AND empresa_id = ?", [id, empresa_id], (err: any, results: any) => {
    if (err || results.length === 0) return res.status(404).json({ error: "Separado no encontrado" });
    
    const separado = results[0];
    if (separado.estado !== "Pendiente") return res.status(400).json({ error: "No se puede completar, estado es: " + separado.estado });
    
    const items = typeof separado.detalles_json === 'string' ? JSON.parse(separado.detalles_json) : separado.detalles_json;
    
    connection.query(
       "INSERT INTO facturas_venta (empresa_id, cajero_id, cliente_id, total, metodo_pago) VALUES (?, ?, ?, ?, ?)", 
       [empresa_id, cajero_id || null, separado.cliente_id, separado.total, metodo_pago || "Efectivo"], 
       (errFV: any, fRes: any) => {
           if (errFV) return res.status(500).json({ error: "Error creando factura final" });
           
           const facturaId = fRes.insertId;
           let promises = [];
           
           for (let item of items) {
               const qty = item.qty || item.cantidad;
               const pItem = new Promise((resolve, reject) => {
                   connection.query(
                       "INSERT INTO ventas (empresa_id, factura_id, producto_id, cantidad, precio_unitario) VALUES (?, ?, ?, ?, ?)", 
                       [empresa_id, facturaId, item.id, qty, item.precio_venta], 
                       (errV: any) => {
                           if (errV) return reject(errV);
                           connection.query("UPDATE productos SET cantidad = cantidad - ? WHERE id = ? AND empresa_id = ?", [qty, item.id, empresa_id], (errU: any) => {
                               if (errU) return reject(errU);
                               resolve(true);
                           });
                       }
                   );
               });
               promises.push(pItem);
           }
           
           Promise.all(promises).then(() => {
               connection.query("UPDATE separados SET estado = 'Pagado', saldo_pendiente = 0 WHERE id = ? AND empresa_id = ?", [id, empresa_id], () => {
                  res.json({ success: true, message: "Separado completado y facturado exitosamente", factura_id: facturaId });
               });
           }).catch(errPr => {
               console.error(errPr);
               res.status(500).json({ error: "Error procesando items e inventario" });
           });
    });
  });
});

// PUT anular separado
router.put("/:id/anular", (req: any, res: any) => {
  const empresa_id = req.user.empresa_id;
  const { id } = req.params;
  connection.query("UPDATE separados SET estado = 'Anulado' WHERE id = ? AND empresa_id = ?", [id, empresa_id], (err: any) => {
    if (err) return res.status(500).json({ error: "Error anulando" });
    res.json({ success: true, message: "Separado anulado correctamente" });
  });
});

export default router;
