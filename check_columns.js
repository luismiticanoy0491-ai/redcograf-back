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

connection.query("SHOW COLUMNS FROM productos", (err, results) => {
  if (err) {
    console.error("Error checking columns:", err);
  } else {
    console.log("COLUMNS_START");
    console.log(JSON.stringify(results, null, 2));
    console.log("COLUMNS_END");
  }
  connection.end();
});
