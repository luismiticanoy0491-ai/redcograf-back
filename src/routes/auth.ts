const express = require("express");
const router = express.Router();
const connection = require("../conection");
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Patch table to migrate old single-tenant 'administradores' into 'usuarios_plataforma' temporarily on load
connection.query(
  "INSERT IGNORE INTO usuarios_plataforma (empresa_id, username, password_hash, role) SELECT 1, username, password_hash, role FROM administradores;",
  (err: any) => { if(err) console.log("Migración ignorada: " + err.message); }
);

// REGISTRO PÚBLICO SAAS (AUTO-SERVICIO)
router.post("/registro-empresa", async (req: any, res: any) => {
  const { nombre_comercial, niti, telefono, correo, username, password } = req.body;

  if (!nombre_comercial || !username || !password) {
    return res.status(400).json({ error: "Nombre Comercial, Usuario y Contraseña son obligatorios" });
  }

  // 1. Validar que el username no exista ya en TODA la plataforma SaaS
  connection.query("SELECT * FROM usuarios_plataforma WHERE username = ?", [username], async (err: any, results: any[]) => {
    if (err) return res.status(500).json({ error: "Error interno de validación" });
    if (results.length > 0) return res.status(409).json({ error: "El nombre de usuario ya está tomado por otra tienda" });

    try {
      const promisePool = connection.promise();
      const dbConn = await promisePool.getConnection();
      
      try {
        await dbConn.beginTransaction();

        // Paso A: Crear Empresa con 7 días Trial
        const queryEmpresa = `
          INSERT INTO empresas_suscritas 
          (nombre_comercial, nit, correo_contacto, telefono_contacto, fecha_vencimiento_suscripcion, estado)
          VALUES (?, ?, ?, ?, DATE_ADD(CURRENT_DATE, INTERVAL 7 DAY), 'Trial')
        `;
        const [resEmp] = await dbConn.query(queryEmpresa, [nombre_comercial, niti || '', correo || '', telefono || '']);
        const empresa_id = (resEmp as any).insertId;

        // Paso B: Crear Perfil de Dueño Global para su nueva tienda
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);

        await dbConn.query(
          "INSERT INTO usuarios_plataforma (empresa_id, username, password_hash, role) VALUES (?, ?, ?, 'dueño')",
          [empresa_id, username, hash]
        );

        await dbConn.commit();
        dbConn.release();

        // 3. Notificación "push/log" para Súper Administrador
        console.log(`[ALERTA SAAS]: 🎉 ¡Nueva empresa registrada!: ${nombre_comercial} (Admin: ${username}). 7 Días Gratis activados.`);

        res.status(201).json({ 
          success: true, 
          message: "¡Tienda registrada con éxito! Disfruta de tus 7 días gratis.",
          empresa_id
        });
      } catch (txError: any) {
         await dbConn.rollback();
         dbConn.release();
         console.error(txError);
         res.status(500).json({ error: "No pudimos crear tu tienda SaaS. Intenta nuevamente." });
      }
    } catch (error: any) {
       console.error("Error Obteniendo Conexión:", error);
       res.status(500).json({ error: "Error conectando a Base de Datos." });
    }
  });
});

// Registrar nuevo usuario interno (Cajeros de una tienda)
router.post("/registro", async (req: any, res: any) => {
  const { empresa_id, username, password, role } = req.body;
  if (!username || !password || !empresa_id) return res.status(400).json({ error: "Faltan datos" });

  connection.query("SELECT * FROM usuarios_plataforma WHERE username = ?", [username], async (err: any, results: any[]) => {
    if (err) return res.status(500).json({ error: "BD Error" });
    if (results.length > 0) return res.status(409).json({ error: "Usuario existe" });

    try {
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(password, salt);
      connection.query(
        "INSERT INTO usuarios_plataforma (empresa_id, username, password_hash, role) VALUES (?, ?, ?, ?)",
        [empresa_id, username, hash, role || 'cajero'],
        (insertErr: any) => {
          if (insertErr) return res.status(500).json({ error: "Error de servidor al guardar cajero" });
          res.status(201).json({ success: true });
        }
      );
    } catch (error) { res.status(500).json({ error: "Error cifrando" }); }
  });
});

// Login
router.post("/login", (req: any, res: any) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: "Requerido user y pass" });

  connection.query(
    "SELECT u.*, e.estado as estado_empresa, e.fecha_vencimiento_suscripcion, e.nombre_comercial FROM usuarios_plataforma u LEFT JOIN empresas_suscritas e ON u.empresa_id = e.id WHERE u.username = ?",
    [username],
    async (err: any, results: any[]) => {
      if (err) return res.status(500).json({ error: "Error de BD" });
      if (results.length === 0) return res.status(401).json({ error: "Credenciales inválidas" });

      const admin = results[0];
      const validPassword = await bcrypt.compare(password, admin.password_hash);
      if (!validPassword) return res.status(401).json({ error: "Credenciales inválidas" });

      const hoy = new Date();
      const fecVen = new Date(admin.fecha_vencimiento_suscripcion);
      
      if (admin.role !== 'superadmin' && fecVen < hoy) {
        return res.status(403).json({ 
          error: "Suscripción Expirada", 
          reason: "expired",
          empresa_id: admin.empresa_id
        });
      }

      const token = jwt.sign(
        { id: admin.id, role: admin.role, username: admin.username, empresa_id: admin.empresa_id, nombre_comercial: admin.nombre_comercial },
        process.env.JWT_SECRET || 'super_secret_key_development',
        { expiresIn: '8h' }
      );

      res.json({ success: true, token, role: admin.role, username: admin.username, empresa_id: admin.empresa_id, nombre_comercial: admin.nombre_comercial }); 
    }
  );
});

module.exports = router;
export {};
