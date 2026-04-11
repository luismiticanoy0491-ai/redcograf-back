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
  
  console.log("Chequeando duplicados de NIT...");
  
  const query = `
    SELECT nit, COUNT(*) as count 
    FROM empresas_suscritas 
    WHERE nit != '' AND nit IS NOT NULL
    GROUP BY nit 
    HAVING count > 1
  `;
  
  connection.query(query, (err, results: any[]) => {
    if (results && results.length > 0) {
      console.log("❌ Se encontraron NITs duplicados:", results);
    } else {
      console.log("✅ No se encontraron NITs duplicados.");
    }
    connection.end();
  });
});
