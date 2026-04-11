import connection from "./conection";

async function deepPayrollCheck() {
    console.log("🔍 Iniciando inspección profunda de tabla 'pagos_empleados'...");
    
    // 1. Verificar columnas
    const describeQuery = `DESCRIBE pagos_empleados`;
    connection.query(describeQuery, (err: any, cols: any) => {
        if (err) {
            console.error("❌ Error al describir la tabla:", err.message);
            process.exit(1);
        }
        
        console.log("📍 Columnas detectadas:");
        cols.forEach((c: any) => console.log(`- ${c.Field} (${c.Type})`));

        // 2. Verificar datos de cajeros y ventas
        console.log("\n🔍 Verificando integridad de datos para el cálculo...");
        const testQuery = `SELECT id, nombre, salario, paga_comisiones, porcentaje_comision FROM cajeros LIMIT 1`;
        connection.query(testQuery, (err2: any, cajeros: any) => {
            if (err2) {
                console.error("❌ Error consultando cajeros:", err2.message);
                process.exit(1);
            }
            if (cajeros.length === 0) {
                console.log("⚠️ No hay cajeros registrados. Eso podría causar un retorno vacío.");
            } else {
                console.log("✅ Acceso a cajeros verificado.");
            }
            process.exit(0);
        });
    });
}

deepPayrollCheck();
