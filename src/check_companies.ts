
import mysql from "mysql2/promise";

async function checkCompanies() {
  const connection = await mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "",
    database: "tienda_db"
  });

  try {
    const [rows]: any = await connection.query("SELECT id, nombre_comercial FROM empresas_suscritas");
    console.log(JSON.stringify(rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await connection.end();
  }
}

checkCompanies();
