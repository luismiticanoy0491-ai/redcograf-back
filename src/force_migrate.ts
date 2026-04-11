
import mysql from "mysql2/promise";

async function forceMigrate() {
  const connection = await mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "",
    database: "tienda_db"
  });

  try {
    console.log("Forcing migration of empresa_config...");
    
    // Check columns
    const [cols]: any = await connection.query("SHOW COLUMNS FROM empresa_config");
    const hasId = cols.some((c: any) => c.Field === 'id');
    const hasEmpresaId = cols.some((c: any) => c.Field === 'empresa_id');

    if (hasId && !hasEmpresaId) {
        // Simple rename
        // First drop default if any
        await connection.query("ALTER TABLE empresa_config MODIFY COLUMN id INT NOT NULL");
        await connection.query("ALTER TABLE empresa_config DROP PRIMARY KEY");
        await connection.query("ALTER TABLE empresa_config CHANGE COLUMN id empresa_id INT NOT NULL");
        await connection.query("ALTER TABLE empresa_config ADD PRIMARY KEY (empresa_id)");
        console.log("Renamed id to empresa_id successfully.");
    }

    // Ensure all missing columns exist
    const addCol = async (name: string, type: string) => {
        if (!cols.some((c: any) => c.Field === name)) {
            await connection.query(`ALTER TABLE empresa_config ADD COLUMN ${name} ${type}`);
            console.log(`Added column ${name}`);
        }
    };

    await addCol('telefono', 'VARCHAR(50) DEFAULT ""');
    await addCol('representante_legal', 'VARCHAR(255) DEFAULT ""');
    await addCol('logo', 'LONGTEXT NULL');
    await addCol('permitir_venta_negativa', 'BOOLEAN DEFAULT 1');

    // Integrity: ensure every company has a row
    const [companies]: any = await connection.query("SELECT id, nombre_comercial FROM empresas_suscritas");
    for (const c of companies) {
        const [exists]: any = await connection.query("SELECT empresa_id FROM empresa_config WHERE empresa_id = ?", [c.id]);
        if (exists.length === 0) {
            await connection.query("INSERT IGNORE INTO empresa_config (empresa_id, nombre_empresa, nit, direccion, correo, resolucion) VALUES (?, ?, '', '', '', '')", [c.id, c.nombre_comercial]);
            console.log(`Created profile for company ${c.id}`);
        }
    }

    console.log("Migration finished.");
  } catch (err) {
    console.error("Migration fatal error:", err);
  } finally {
    await connection.end();
  }
}

forceMigrate();
