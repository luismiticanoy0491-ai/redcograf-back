import mysql from "mysql2";

const connection = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "",
  database: "tienda_db"
});

const migrationQueries = [
  // Add direccion to clientes
  "ALTER TABLE clientes ADD COLUMN IF NOT EXISTS direccion VARCHAR(255) DEFAULT '';",
  
  // Add split payment columns to facturas_venta
  "ALTER TABLE facturas_venta ADD COLUMN IF NOT EXISTS pago_efectivo DECIMAL(15,2) DEFAULT 0.00;",
  "ALTER TABLE facturas_venta ADD COLUMN IF NOT EXISTS pago_transferencia DECIMAL(15,2) DEFAULT 0.00;",
  
  // Add direccion, nit, correo, etc to proveedores? 
  // Let's check proveedores table first. Since I can't DESC, I'll just try to add them if missing.
  // Actually, the proveedores.ts routes use: nombre, contacto, direccion, telefono, email.
  // I'll create the table if it's missing just in case, but usually it exists.
  "CREATE TABLE IF NOT EXISTS proveedores (id INT AUTO_INCREMENT PRIMARY KEY, nombre VARCHAR(255) NOT NULL, contacto VARCHAR(100), direccion VARCHAR(255), telefono VARCHAR(50), email VARCHAR(100));"
];

connection.connect((err) => {
  if (err) {
    console.error("Error connecting to DB:", err);
    process.exit(1);
  }
  
  console.log("Connected to DB. Running migrations...");
  
  let completed = 0;
  migrationQueries.forEach((query) => {
    connection.query(query, (err) => {
      if (err) {
        console.error("Error running query:", query, err.message);
      } else {
        console.log("Success:", query.substring(0, 50) + "...");
      }
      completed++;
      if (completed === migrationQueries.length) {
        console.log("Migrations finished.");
        connection.end();
      }
    });
  });
});
