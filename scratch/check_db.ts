import pool from "../src/conection";

async function dump() {
  try {
    const [cajeros]: any = await pool.promise().query("SELECT * FROM cajeros");
    console.log("Cajeros:", JSON.stringify(cajeros, null, 2));
    const [empresas]: any = await pool.promise().query("SELECT * FROM empresas_suscritas");
    console.log("Empresas:", JSON.stringify(empresas, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

dump();
