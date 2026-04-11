import pool from "../src/conection";

async function dump() {
  try {
    const [clientes]: any = await pool.promise().query("SELECT * FROM clientes");
    console.log("Clientes:", JSON.stringify(clientes, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

dump();
