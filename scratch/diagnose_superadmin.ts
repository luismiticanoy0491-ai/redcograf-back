import mysql from "mysql2";
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const connection = mysql.createConnection({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "tienda_db"
});

connection.connect((err) => {
  if (err) {
    console.error("Error conectando:", err);
    process.exit(1);
  }
  
  console.log("Conectado para diagnóstico de SuperAdmin...");
  
  // 1. Buscar empresas que coincidan con "DEDCOGRAF" o "REDCOGRAF"
  const queryEmpresas = "SELECT id, nombre_comercial, nit FROM empresas_suscritas WHERE nombre_comercial LIKE '%DEDCOGRAF%' OR nombre_comercial LIKE '%REDCOGRAF%' OR nombre_comercial LIKE '%PAPELERIA%'";
  
  connection.query(queryEmpresas, (err, empresas: any[]) => {
    if (err) {
      console.error("Error al buscar empresas:", err);
      connection.end();
      return;
    }
    
    console.log("Empresas encontradas:", empresas);
    
    if (empresas.length === 0) {
      console.log("No se encontraron empresas con esos nombres.");
      connection.end();
      return;
    }
    
    const empresaIds = empresas.map(e => e.id);
    
    // 2. Buscar usuarios asociados a esas empresas
    const queryUsuarios = "SELECT id, empresa_id, username, role FROM usuarios_plataforma WHERE empresa_id IN (?) OR role = 'superadmin'";
    
    connection.query(queryUsuarios, [empresaIds], (err, usuarios: any[]) => {
      if (err) {
        console.error("Error al buscar usuarios:", err);
      } else {
        console.log("Usuarios encontrados:", usuarios);
      }
      connection.end();
    });
  });
});
