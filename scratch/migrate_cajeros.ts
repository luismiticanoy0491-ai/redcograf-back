import pool from "../src/conection";

async function migrate() {
  try {
    console.log("Iniciando migración de tabla cajeros...");
    
    // Añadir columnas si no existen
    const queries = [
      "ALTER TABLE cajeros ADD COLUMN IF NOT EXISTS telefono VARCHAR(50) AFTER documento;",
      "ALTER TABLE cajeros ADD COLUMN IF NOT EXISTS direccion VARCHAR(255) AFTER telefono;",
      "ALTER TABLE cajeros ADD COLUMN IF NOT EXISTS fecha_contrato DATE AFTER direccion;"
    ];

    for (const q of queries) {
      await pool.promise().query(q);
      console.log(`Ejecutado: ${q}`);
    }

    console.log("✅ Migración completada exitosamente.");
    process.exit(0);
  } catch (err: any) {
    console.error("❌ Error en la migración:", err.message);
    process.exit(1);
  }
}

migrate();
