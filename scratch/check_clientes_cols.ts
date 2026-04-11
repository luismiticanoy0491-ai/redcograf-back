import pool from "../src/conection";

async function checkColumns() {
  try {
    const [columns]: any = await pool.promise().query("SHOW COLUMNS FROM clientes");
    console.log("Clientes Columns:", JSON.stringify(columns, null, 2));
    process.exit(0);
  } catch (err: any) {
    console.error("Error:", err.message);
    process.exit(1);
  }
}

checkColumns();
