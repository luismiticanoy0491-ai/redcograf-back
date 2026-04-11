import pool from "../src/conection";

async function test() {
  try {
    const empresa_id = 1;
    const cId = NaN; // simulate what might be happening
    const clId = 1;
    const total = 1000;
    const metodoPago = "Mixto";
    const pef = 500;
    const ptr = 500;

    console.log("Values to insert:", { empresa_id, cId, clId, total, metodoPago, pef, ptr });

    const [resCab]: any = await pool.promise().query(
      "INSERT INTO facturas_venta (empresa_id, cajero_id, cliente_id, total, metodo_pago, pago_efectivo, pago_transferencia) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [empresa_id, cId, clId, total, metodoPago, pef, ptr]
    );
    console.log("Insert success, ID:", resCab.insertId);
    process.exit(0);
  } catch (err: any) {
    console.error("Error caught:", err.message);
    process.exit(0);
  }
}

test();
