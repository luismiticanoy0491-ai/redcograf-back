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
  
  console.log("Conectado para migración de OTP...");
  
  const query = `
    CREATE TABLE IF NOT EXISTS otp_verifications (
      id INT AUTO_INCREMENT PRIMARY KEY,
      usuario_id INT NOT NULL,
      codigo VARCHAR(10) NOT NULL,
      tipo VARCHAR(20) NOT NULL,
      expiracion TIMESTAMP NOT NULL,
      intentos INT DEFAULT 0,
      usado BOOLEAN DEFAULT 0,
      fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (usuario_id) REFERENCES usuarios_plataforma(id) ON DELETE CASCADE
    );
  `;
  
  connection.query(query, (err) => {
    if (err) {
      console.error("Error al crear tabla OTP:", err);
    } else {
      console.log("✅ Tabla 'otp_verifications' creada exitosamente.");
    }
    connection.end();
  });
});
