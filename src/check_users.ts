
import mysql from "mysql2/promise";

async function checkUsers() {
  const connection = await mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "",
    database: "tienda_db"
  });

  try {
    const [rows]: any = await connection.query("SELECT id, username, empresa_id, role FROM usuarios_plataforma");
    console.log(JSON.stringify(rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await connection.end();
  }
}

checkUsers();
