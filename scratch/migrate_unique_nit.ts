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
  
  console.log("Aplicando restricción UNIQUE al NIT...");
  
  const query = "ALTER TABLE empresas_suscritas ADD UNIQUE (nit)";
  
  connection.query(query, (err) => {
    if (err) {
      console.error("Error al aplicar UNIQUE:", err.message);
    } else {
      console.log("✅ Restricción UNIQUE aplicada exitosamente a la columna 'nit'.");
    }
    connection.end();
  });
});
