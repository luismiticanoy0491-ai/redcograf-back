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
  
  console.log("Conectado para actualización de SuperAdmin...");
  
  // Actualizar usuario 'redcograf' (ID 2) a superadmin
  const query = "UPDATE usuarios_plataforma SET role = 'superadmin' WHERE username = 'redcograf' AND empresa_id = 1";
  
  connection.query(query, (err, results: any) => {
    if (err) {
      console.error("Error al actualizar rol:", err);
    } else {
      console.log(`✅ Usuario 'redcograf' actualizado a superadmin. Filas afectadas: ${results.affectedRows}`);
    }
    connection.end();
  });
});
