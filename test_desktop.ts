import pool from "./src/conection";

async function testVentaSimulada() {
  const conn = await pool.promise().getConnection();
  try {
    await conn.beginTransaction();
    const empresa_id = 1;
    const item = { id: 1, qty: 3, precio_venta: 70000, precio_compra: 50000, nombre: "Producto Ejemplo 1" };
    
    // 1. Lock Row
    console.log("1. Bloqueando producto...");
    const [stocks]: any = await conn.query("SELECT cantidad, es_servicio FROM productos WHERE id = ? AND empresa_id = ? FOR UPDATE", [item.id, empresa_id]);
    const stock_antes = stocks[0].cantidad;
    
    // 2. Update Stock
    console.log(`2. Actualizando stock (${stock_antes} -> ${stock_antes - item.qty})`);
    await conn.query("UPDATE productos SET cantidad = cantidad - ? WHERE id = ? AND empresa_id = ?", [item.qty, item.id, empresa_id]);
    
    // 3. Insert Kardex
    console.log("3. Insertando Kardex...");
    await conn.query(
      "INSERT INTO kardex (producto_id, empresa_id, tipo_movimiento, cantidad_antes, cantidad_modificada, cantidad_despues, motivo, referencia) VALUES (?, ?, 'SALIDA', ?, ?, ?, 'Prueba de Escritorio', 'TEST-001')",
      [item.id, empresa_id, stock_antes, item.qty, stock_antes - item.qty]
    );
    
    await conn.commit();
    console.log("✅ Prueba completada con éxito");
  } catch (e: any) {
    await conn.rollback();
    console.error("❌ Fallo en la prueba:", e.message);
  } finally {
    conn.release();
    process.exit();
  }
}

testVentaSimulada();
