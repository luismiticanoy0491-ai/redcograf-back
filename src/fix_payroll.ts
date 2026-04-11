import connection from "./conection";

async function checkAndFixPayroll() {
    console.log("🔍 Iniciando diagnóstico de tabla de nómina...");
    
    const checkTableQuery = `SHOW TABLES LIKE 'pagos_empleados'`;
    
    connection.query(checkTableQuery, (err: any, results: any) => {
        if (err) {
            console.error("❌ Error al consultar tablas:", err);
            process.exit(1);
        }

        if (results.length === 0) {
            console.log("⚠️ La tabla 'pagos_empleados' NO existe. Creándola...");
            
            const createTableQuery = `
                CREATE TABLE pagos_empleados (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    empresa_id INT NOT NULL,
                    cajero_id INT NOT NULL,
                    mes INT NOT NULL,
                    anio INT NOT NULL,
                    salario_base DECIMAL(15,2) NOT NULL,
                    comisiones DECIMAL(15,2) DEFAULT 0,
                    total_pagado DECIMAL(15,2) NOT NULL,
                    fecha_pago TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    metodo_pago VARCHAR(100) DEFAULT 'Efectivo',
                    FOREIGN KEY (empresa_id) REFERENCES empresas_suscritas(id) ON DELETE CASCADE,
                    FOREIGN KEY (cajero_id) REFERENCES cajeros(id) ON DELETE CASCADE
                )
            `;

            connection.query(createTableQuery, (errCreate: any) => {
                if (errCreate) {
                    console.error("❌ Falló la creación de la tabla:", errCreate);
                } else {
                    console.log("✅ Tabla 'pagos_empleados' creada exitosamente.");
                }
                process.exit(0);
            });
        } else {
            console.log("✅ La tabla 'pagos_empleados' ya existe en la base de datos.");
            process.exit(0);
        }
    });
}

checkAndFixPayroll();
