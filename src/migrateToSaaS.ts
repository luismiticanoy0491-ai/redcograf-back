import { RowDataPacket } from 'mysql2';
const mysql = require("mysql2/promise");

async function migrateSaaS() {
  const connection = await mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "",
    database: "tienda_db",
    multipleStatements: true
  });

  try {
    console.log("Iniciando Migración hacia SaaS (Multi-tienda)...");

    // 1. Crear Tablas Globales SaaS
    const globalTables = `
      CREATE TABLE IF NOT EXISTS empresas_suscritas (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nombre_comercial VARCHAR(255) NOT NULL,
        nit VARCHAR(100) DEFAULT '',
        correo_contacto VARCHAR(100),
        telefono_contacto VARCHAR(50),
        fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        fecha_vencimiento_suscripcion DATE NOT NULL,
        estado VARCHAR(50) DEFAULT 'Trial',
        wompi_subscription_id VARCHAR(255) NULL
      );

      CREATE TABLE IF NOT EXISTS usuarios_plataforma (
        id INT AUTO_INCREMENT PRIMARY KEY,
        empresa_id INT NOT NULL,
        username VARCHAR(100) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'dueño',
        FOREIGN KEY (empresa_id) REFERENCES empresas_suscritas(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS pagos_suscripcion (
        id INT AUTO_INCREMENT PRIMARY KEY,
        empresa_id INT NOT NULL,
        wompi_transaction_id VARCHAR(255) NOT NULL,
        monto DECIMAL(15,2) NOT NULL,
        fecha_pago TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        metodo_pago VARCHAR(100) DEFAULT 'Wompi',
        dias_agregados INT DEFAULT 30,
        FOREIGN KEY (empresa_id) REFERENCES empresas_suscritas(id) ON DELETE CASCADE
      );

      INSERT IGNORE INTO empresas_suscritas (id, nombre_comercial, fecha_vencimiento_suscripcion, estado) 
      VALUES (1, 'Mi Empresa Original (Migrada)', DATE_ADD(CURRENT_DATE, INTERVAL 3650 DAY), 'Active');
    `;
    await connection.query(globalTables);
    console.log("✅ Tablas globales creadas o verificadas. Empresa por defecto inyectada.");

    // 2. Tablas a migrar agregando empresa_id
    const tablasAMigrar = [
      'productos', 'cajeros', 'clientes', 'facturas_venta', 
      'ventas', 'pagos_empleados', 'facturas_borrador', 
      'facturas_compra', 'separados', 'abonos_separados', 'empresa_config'
    ];

    for (const tabla of tablasAMigrar) {
      try {
        // Chequear si existe la tabla primero (algunas como separados podrían no estar creadas si el usario no lo probó aún)
        const [tablesExists] = await connection.query(`SHOW TABLES LIKE '${tabla}'`);
        
        if ((tablesExists as RowDataPacket[]).length > 0) {
          // Chequear si la columna existe (usando un truco infalible en vez de information_schema que a veces falla por permisos)
          const [columns] = await connection.query(`SHOW COLUMNS FROM \`${tabla}\` LIKE 'empresa_id'`);
          
          if ((columns as RowDataPacket[]).length === 0) {
            console.log(`Alterando tabla ${tabla}: agregando empresa_id...`);
            await connection.query(`
              ALTER TABLE \`${tabla}\`
              ADD COLUMN empresa_id INT NOT NULL DEFAULT 1
            `);
            
            // Adding Foreign Key constraint separately
            await connection.query(`
              ALTER TABLE \`${tabla}\`
              ADD CONSTRAINT \`fk_${tabla}_empresa\` FOREIGN KEY (empresa_id) REFERENCES empresas_suscritas(id) ON DELETE CASCADE
            `);
            console.log(`✅ Tabla ${tabla} Alterada exitosamente.`);
          } else {
            console.log(`⚡ La tabla ${tabla} ya contenía empresa_id (Saltado).`);
          }
        } else {
          console.log(`⚠️ La tabla ${tabla} no existe en la DB. (Asegúrate de haber corrido los setups antiguos primero si era necesario).`);
        }
      } catch (e: any) {
        console.error(`❌ Error alterando tabla ${tabla}: `, e.message);
      }
    }

    console.log("🚀 MIGRACIÓN A SAAS MULTITIENDA COMPLETADA CON ÉXITO.");
  } catch (error) {
    console.error("Error general en la migración:", error);
  } finally {
    await connection.end();
  }
}

migrateSaaS();
