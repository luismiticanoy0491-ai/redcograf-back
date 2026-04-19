import express from "express";
import connection from "../conection";

const router = express.Router();

// Endpoint principal de exportación maestra
router.get("/download", (req, res) => {
  // Las tablas torales de la aplicación a respaldar en el archivo universal de exportación
  const tablas = [
    "productos", 
    "cajeros", 
    "clientes", 
    "facturas_venta", 
    "ventas", 
    "borradores", 
    "empresa",
    "proveedores"
  ];
  
  const backupData = {};
  
  let queriesCompleted = 0;
  let hasError = false;

  tablas.forEach((tabla) => {
    connection.query(`SELECT * FROM ${tabla}`, (err, results) => {
      if (hasError) return; // Evitar colapsar la respuesta en caso de errores en cadena
      
      if (err) {
        // En caso de que una de las expansiones de BD fracase
        // O si el usuario borró una tabla manualmente desde PhpMyAdmin
        hasError = true;
        console.error(`Error crítico compilando archivo madre. Fallo en tabla ${tabla}:`, err);
        return res.status(500).json({ error: "Fallo al generar copia de seguridad para bloque interno " + tabla });
      }

      // Incrustar resultados exitosos en el objeto vivo
      backupData[tabla] = results;
      queriesCompleted++;

      // Una vez compiladas / resueltas todas las solicitudes a la BD SQL
      if (queriesCompleted === tablas.length) {
        const d = new Date();
        const pad = (n: number) => n.toString().padStart(2, '0');
        const fecha = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; // Formato local YYYY-MM-DD
        const horaSecudaria = d.getTime().toString().substring(7); // Token numérico de seguridad temporal
        const filename = `copia_seguridad_tienda_${fecha}_${horaSecudaria}.json`;
        
        // Preparar a la conexión de Express para escupir el binario hacia el entorno Windows como "Descargar"
        res.setHeader('Content-disposition', `attachment; filename=${filename}`);
        res.setHeader('Content-type', 'application/json');
        res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
        
        const backupString = JSON.stringify({
          plataforma: "Sistema POS v1.0",
          fecha_backup_hora: d.toLocaleString('es-CO', { timeZone: 'America/Bogota' }),
          tablas_exportadas: tablas.length,
          datos: backupData
        }, null, 2); // 2 espacios identados para permitir que un informático pueda auditar el json si fuese requerido
        
        // Push to client
        res.send(backupString);
      }
    });
  });
});

export default router;
