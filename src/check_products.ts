
import mysql from "mysql2/promise";

async function checkProducts() {
  const connection = await mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "",
    database: "tienda_db"
  });

  try {
    const [rows]: any = await connection.query("SELECT COUNT(*) as total FROM productos");
    console.log(`Total productos en DB: ${rows[0].total}`);
    
    if (rows[0].total > 0) {
        const [sample]: any = await connection.query("SELECT id, empresa_id, nombre FROM productos LIMIT 5");
        console.log("Muestra de productos:", JSON.stringify(sample, null, 2));
    }
  } catch (err) {
    console.error("Error consultando productos:", err);
  } finally {
    await connection.end();
  }
}

checkProducts();
