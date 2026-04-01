const express = require("express");
const router = express.Router();
const connection = require("../conection");
const crypto = require("crypto");

// NOTA: Wompi requiere un endpoint público para mandar el Evento (No requiere Token JWT local)
// Webhook URL a configurar en el Dashboard de Wompi: https://tudominio.com/api/suscripciones/wompi-webhook
router.post("/wompi-webhook", (req: any, res: any) => {
  const evento = req.body;

  if (evento && evento.event === "transaction.updated") {
    const transaction = evento.data.transaction;

    // Solo si la transacción es aprobada
    if (transaction.status === "APPROVED") {
      const { reference, id: wompiTxId, amount_in_cents } = transaction;
      // "reference" la armaremos en el frontend como: SUB_EMPRESAID_TIMESTAMP
      const parts = reference.split("_");
      if (parts[0] === "SUB" && parts[1]) {
        const empresa_id = parseInt(parts[1], 10);
        const montoPesos = amount_in_cents / 100;

        // Registrar Pago
        const qPago = "INSERT INTO pagos_suscripcion (empresa_id, wompi_transaction_id, monto, dias_agregados) VALUES (?, ?, ?, 30)";
        connection.query(qPago, [empresa_id, wompiTxId, montoPesos], (err: any) => {
          if (err) console.error("Error registrando pago en BD", err);
          
          // Sumar 30 días a su fecha de vencimiento o desde HOY si estaba expirado
          const qActualizarSuscripcion = `
            UPDATE empresas_suscritas 
            SET estado = 'Active',
            fecha_vencimiento_suscripcion = CASE 
                WHEN fecha_vencimiento_suscripcion < CURRENT_DATE() THEN DATE_ADD(CURRENT_DATE(), INTERVAL 30 DAY)
                ELSE DATE_ADD(fecha_vencimiento_suscripcion, INTERVAL 30 DAY)
            END
            WHERE id = ?
          `;
          connection.query(qActualizarSuscripcion, [empresa_id], (err2: any) => {
             if(err2) console.error("Error renovando la tiensa", err2);
             console.log(`[WOMPI] Suscripción pagada éxito: Empresa #${empresa_id} pagó $${montoPesos}. Fecha extendida.`);
          });
        });
      }
    }
  }

  // Wompi exige respuesta 200 rápida
  res.status(200).send("OK");
});

// Endpoint para obtener estado de la suscripción (Protegido para el Front de cada Tenant)
const { verifyTokenAndTenant } = require("../middlewares/authMiddleware");
router.get("/estado", verifyTokenAndTenant, (req: any, res: any) => {
  const empresa_id = req.user.empresa_id;
  
  if(req.user.role === 'superadmin') {
     return res.json({ estado: 'Active', diasRestantes: 9999 });
  }

  connection.query(
    "SELECT estado, fecha_vencimiento_suscripcion, DATEDIFF(fecha_vencimiento_suscripcion, CURRENT_DATE()) as diasRestantes FROM empresas_suscritas WHERE id = ?", 
    [empresa_id], 
    (err: any, results: any) => {
      if (err || results.length === 0) return res.status(500).json({ error: "Error consultando estado." });
      res.json(results[0]);
    }
  );
});

// Endpoint exclusivo Super Administrador: Ver TODAS las tiendas
router.get("/superadmin/empresas", verifyTokenAndTenant, (req: any, res: any) => {
  if(req.user.role !== 'superadmin') {
     return res.status(403).json({ error: "No autorizado. Requiere rol superadmin." });
  }

  connection.query(
    `SELECT e.*, 
            (SELECT SUM(monto) FROM pagos_suscripcion WHERE empresa_id = e.id) as total_recaudado,
            u.username as owner_username
     FROM empresas_suscritas e
     LEFT JOIN usuarios_plataforma u ON u.empresa_id = e.id AND u.role = 'dueño'
     ORDER BY e.fecha_registro DESC`, 
    (err: any, results: any) => {
      if (err) return res.status(500).json({ error: "Error consultando tiendas SaaS." });
      res.json(results);
    }
  );
});

// Endpoint exclusivo Super Administrador: Ver HISTORIAL DE PAGOS
router.get("/superadmin/pagos", verifyTokenAndTenant, (req: any, res: any) => {
  if(req.user.role !== 'superadmin') {
     return res.status(403).json({ error: "No autorizado. Requiere rol superadmin." });
  }

  connection.query(
    `SELECT p.*, e.nombre_comercial 
     FROM pagos_suscripcion p
     JOIN empresas_suscritas e ON p.empresa_id = e.id
     ORDER BY p.id DESC`,
    (err: any, results: any) => {
      if (err) {
         // Si la tabla aún no existe, devolvemos un arreglo vacío temporalmente en vez de quebrar el panel
         if (err.code === 'ER_NO_SUCH_TABLE') {
            return res.json([]);
         }
         return res.status(500).json({ error: "Error consultando historial de pagos." });
      }
      res.json(results);
    }
  );
});

module.exports = router;
export {};
