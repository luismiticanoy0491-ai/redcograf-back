import pool from "../src/conection";

async function migrate() {
  try {
    console.log("Iniciando migración de tabla clientes...");
    
    // Añadir columnas si no existen
    const queries = [
      "ALTER TABLE clientes ADD COLUMN IF NOT EXISTS correo VARCHAR(100) AFTER telefono;",
      "ALTER TABLE clientes ADD COLUMN IF NOT EXISTS direccion VARCHAR(255) AFTER correo;"
    ];

    for (const q of queries) {
      await pool.promise().query(q);
      console.log(`Ejecutado: ${q}`);
    }

    console.log("✅ Migración de clientes completada exitosamente.");
    process.exit(0);
  } catch (err: any) {
    console.error("❌ Error en la migración de clientes:", err.message);
    process.exit(1);
  }
}

migrate();
