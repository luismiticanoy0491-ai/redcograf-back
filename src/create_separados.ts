const mysql = require("mysql2");

const connection = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "",
  database: "tienda_db",
  multipleStatements: true
});

connection.connect((err) => {
  if (err) throw err;
  
  const setupQueries = `
    CREATE TABLE IF NOT EXISTS separados (
      id INT AUTO_INCREMENT PRIMARY KEY,
      cliente_id INT,
      fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      total DECIMAL(15,2) NOT NULL,
      saldo_pendiente DECIMAL(15,2) NOT NULL,
      estado VARCHAR(20) DEFAULT 'Pendiente', -- Pendiente, Pagado, Anulado
      detalles_json JSON NOT NULL,
      FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS abonos_separados (
      id INT AUTO_INCREMENT PRIMARY KEY,
      separado_id INT,
      fecha_abono TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      monto DECIMAL(15,2) NOT NULL,
      FOREIGN KEY (separado_id) REFERENCES separados(id) ON DELETE CASCADE
    );
  `;

  connection.query(setupQueries, (err) => {
    if (err) throw err;
    console.log("Tablas de separados creadas");
    connection.end();
  });
});

export {};
