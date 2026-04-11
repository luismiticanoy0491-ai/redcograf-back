import mysql from "mysql2/promise";
async function run() {
  const c = await mysql.createConnection({host:'localhost',user:'root',password:'',database:'tienda_db'});
  const hash = "$2b$10$Srhb7e3.J9LRn24/QPx0CuyLqJhQ.zR.utVqd7af2F2SBoejy3ruy";
  await c.query('UPDATE usuarios_plataforma SET password_hash = ? WHERE username = "redcograf"', [hash]);
  console.log("✅ Hash corregido sin interferencia de shell.");
  c.end();
}
run();
