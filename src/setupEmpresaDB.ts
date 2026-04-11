import mysql from "mysql2";

const connection = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "",
  database: "tienda_db"
});

connection.connect((err) => {
  if (err) throw err;
  
  const sql = `
    CREATE TABLE IF NOT EXISTS empresa_config (
      empresa_id INT PRIMARY KEY,
      nombre_empresa VARCHAR(255) NOT NULL,
      nit VARCHAR(100) NOT NULL,
      direccion VARCHAR(255) NOT NULL,
      telefono VARCHAR(50) DEFAULT '',
      correo VARCHAR(100) NOT NULL,
      resolucion TEXT NOT NULL,
      permitir_venta_negativa BOOLEAN DEFAULT 1,
      representante_legal VARCHAR(255) DEFAULT '',
      logo LONGTEXT NULL,
      FOREIGN KEY (empresa_id) REFERENCES empresas_suscritas(id) ON DELETE CASCADE
    );
  `;
  
  connection.query(sql, (err) => {
    if (err) throw err;
    console.log("Tabla de empresa configurada.");
    connection.end();
  });
});


