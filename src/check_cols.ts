
import mysql from "mysql2/promise";

async function checkCols() {
  const connection = await mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "",
    database: "tienda_db"
  });

  try {
    const [cols]: any = await connection.query("SHOW COLUMNS FROM empresa_config");
    console.log(JSON.stringify(cols, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await connection.end();
  }
}

checkCols();
