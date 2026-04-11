const mysql = require("mysql2");
const dotenv = require("dotenv");
dotenv.config();

const connection = mysql.createConnection({
  host: process.env.DB_HOST || "127.0.0.1",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "tienda_db",
  port: Number(process.env.DB_PORT) || 3306
});

connection.connect();

const sql = "ALTER TABLE productos ADD COLUMN es_servicio TINYINT(1) DEFAULT 0";

connection.query(sql, (err, results) => {
  if (err) {
    if (err.code === 'ER_DUP_COLUMN_NAME') {
      console.log("Column 'es_servicio' already exists. Skipping.");
    } else {
      console.error("Error adding column:", err);
    }
  } else {
    console.log("Column 'es_servicio' added successfully!");
  }
  connection.end();
});
