const mysql = require("mysql2");

const connection = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "",
  database: "tienda_db"
});

connection.connect((err) => {
  if (err) throw err;
  
  const addColumnQuery = "ALTER TABLE facturas_borrador ADD COLUMN numero_factura VARCHAR(100) DEFAULT '' AFTER proveedor;";
  
  connection.query(addColumnQuery, (err) => {
    // If it throws duplicate column, ignore it
    if (err && err.code !== 'ER_DUP_FIELDNAME') {
      console.error("❌ SQL ERROR:", err.message);
    } else {
      console.log("✅ Columna numero_factura agregada exitosamente.");
    }
    connection.end();
  });
});

export {};
