
import mysql from "mysql2/promise";

async function checkRows() {
  const connection = await mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "",
    database: "tienda_db"
  });

  try {
    const [rows]: any = await connection.query("SELECT empresa_id, nombre_empresa FROM empresa_config");
    console.log(JSON.stringify(rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await connection.end();
  }
}

checkRows();
