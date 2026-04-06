import express from "express";
import pool from "../conection";
import { verifyTokenAndTenant } from "../middlewares/authMiddleware";

const router = express.Router();

// Middleware de seguridad
router.use(verifyTokenAndTenant);

router.post("/", (req: any, res: any) => {
  const empresa_id = req.user.empresa_id;
  const { items, metodoPago, cajeroId, clienteId, total } = req.body;
  
  if (!items || items.length === 0) return res.status(400).json({ error: "Carrito vacío" });

  pool.getConnection((err: any, conn: any) => {
    if (err) return res.status(500).json({ error: "Fallo conexión a BD" });

    conn.beginTransaction((errTx: any) => {
      if (errTx) {
        conn.release();
        return res.status(500).json({ error: "No se pudo iniciar transacción" });
      }

      const cId = cajeroId || null;
      const clId = clienteId || null;
      
      conn.query(
        "INSERT INTO facturas_venta (empresa_id, cajero_id, cliente_id, total, metodo_pago) VALUES (?, ?, ?, ?, ?)",
        [empresa_id, cId, clId, total, metodoPago],
        (errCabecera: any, resultsCabecera: any) => {
          if (errCabecera) return rollback(conn, res, errCabecera, "Fallo cabecera factura");
          
          const facturaId = resultsCabecera.insertId;
          let pending = items.length;
          let fallbackError: any = null;

          items.forEach((item: any) => {
            conn.query(
              "INSERT INTO ventas (empresa_id, factura_id, producto_id, cantidad, precio_unitario, costo_unitario) VALUES (?, ?, ?, ?, ?, ?)", 
              [empresa_id, facturaId, item.id, item.qty, item.precio_venta, item.precio_compra || 0], 
              (err1: any) => {
                if (err1) fallbackError = err1;

                conn.query("UPDATE productos SET cantidad = cantidad - ? WHERE id = ? AND empresa_id = ?", [item.qty, item.id, empresa_id], (err2: any) => {
                  if (err2) fallbackError = err2;

                  pending--;
                  if (pending === 0) {
                    if (fallbackError) return rollback(conn, res, fallbackError, "Fallo descontando inventario");

                    conn.commit((errCmt: any) => {
                      if (errCmt) return rollback(conn, res, errCmt, "BD fail");
                      conn.release();
                      res.status(201).json({ success: true, factura_id: facturaId, message: "Factura registrada" });
                    });
                  }
                });
            });
          });
        }
      );
    });
  });
});

router.get("/", (req: any, res: any) => {
  const empresa_id = req.user.empresa_id;
  const query = `
    SELECT f.id, f.fecha, f.total, f.metodo_pago, c.nombre AS cajero, cl.nombre AS cliente 
    FROM facturas_venta f
    LEFT JOIN cajeros c ON f.cajero_id = c.id
    LEFT JOIN clientes cl ON f.cliente_id = cl.id
    WHERE f.empresa_id = ?
    ORDER BY f.fecha DESC
  `;
  pool.query(query, [empresa_id], (err: any, results: any) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
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

router.delete("/:id", (req: any, res: any) => {
  const empresa_id = req.user.empresa_id;
  const facturaId = req.params.id;

  pool.getConnection((err: any, conn: any) => {
    if (err) return res.status(500).json({ error: "No connection DB" });

    conn.beginTransaction((errTx: any) => {
      if (errTx) { conn.release(); return res.status(500).json({ error: "No tx" }); }

      conn.query("SELECT producto_id, cantidad FROM ventas WHERE factura_id = ? AND empresa_id = ?", [facturaId, empresa_id], (errItems: any, items: any[]) => {
        if (errItems) return rollback(conn, res, errItems, "Fallo leyendo detalles");
        
        if (items.length === 0) {
          borrarFactura(facturaId, empresa_id, conn, res);
        } else {
          let pending = items.length;
          let fallbackError: any = null;

          items.forEach((item: any) => {
            conn.query("UPDATE productos SET cantidad = cantidad + ? WHERE id = ? AND empresa_id = ?", [item.cantidad, item.producto_id, empresa_id], (errU: any) => {
              if (errU) fallbackError = errU;
              pending--;
              if (pending === 0) {
                if (fallbackError) return rollback(conn, res, fallbackError, "Error devolviendo stock");
                borrarFactura(facturaId, empresa_id, conn, res);
              }
            });
          });
        }
      });
    });
  });
});

function borrarFactura(facturaId: number, empresa_id: number, conn: any, res: any) {
  conn.query("DELETE FROM ventas WHERE factura_id = ? AND empresa_id = ?", [facturaId, empresa_id], (err1: any) => {
    if (err1) return rollback(conn, res, err1, "Detalle rollback err");
    conn.query("DELETE FROM facturas_venta WHERE id = ? AND empresa_id = ?", [facturaId, empresa_id], (err2: any) => {
      if (err2) return rollback(conn, res, err2, "Cabecera err");
      conn.commit((errC: any) => {
        if (errC) return rollback(conn, res, errC, "Commit fallido");
        conn.release();
        res.json({ success: true, message: "Factura anulada" });
      });
    });
  });
}

function rollback(conn: any, res: any, err: any, msg: string) {
  console.error(err);
  return conn.rollback(() => {
    conn.release();
    res.status(500).json({ error: msg });
  });
}

export default router;
