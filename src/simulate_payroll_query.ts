import connection from "./conection";

async function simulatePayrollQuery() {
    const empresa_id = 1; // ID por defecto de la empresa principal
    const mes = new Date().getMonth() + 1;
    const anio = new Date().getFullYear();

    console.log(`🧪 Simulando consulta de nómina para Empresa: ${empresa_id}, Mes: ${mes}/${anio}`);

    const queryVentas = `
        SELECT cajero_id, SUM(total) as total_ventas 
        FROM facturas_venta 
        WHERE empresa_id = ? AND MONTH(fecha) = ? AND YEAR(fecha) = ? 
        GROUP BY cajero_id;
    `;

    connection.query(queryVentas, [empresa_id, mes, anio], (err: any, results: any) => {
        if (err) {
            console.error("❌ ERROR EN CONSULTA DE VENTAS:");
            console.error("Mensaje:", err.message);
            console.error("Código:", err.code);
            process.exit(1);
        }
        console.log("✅ Consulta de ventas exitosa. Resultados:", results.length);
        
        const queryPagos = `
            SELECT * FROM pagos_empleados 
            WHERE empresa_id = ? AND mes = ? AND anio = ?;
        `;

        connection.query(queryPagos, [empresa_id, mes, anio], (err2: any, results2: any) => {
            if (err2) {
                console.error("❌ ERROR EN CONSULTA DE PAGOS:");
                console.error("Mensaje:", err2.message);
                process.exit(1);
            }
            console.log("✅ Consulta de historial de pagos exitosa.");
            process.exit(0);
        });
    });
}

simulatePayrollQuery();
