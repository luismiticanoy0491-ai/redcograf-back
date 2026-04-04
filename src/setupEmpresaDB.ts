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
      id INT PRIMARY KEY DEFAULT 1,
      nombre_empresa VARCHAR(255) NOT NULL,
      nit VARCHAR(100) NOT NULL,
      direccion VARCHAR(255) NOT NULL,
      correo VARCHAR(100) NOT NULL,
      resolucion TEXT NOT NULL
    );
  `;
  
  connection.query(sql, (err) => {
    if (err) throw err;
    console.log("Tabla de empresa configurada.");
    
    const insertSQL = `
      INSERT IGNORE INTO empresa_config (id, nombre_empresa, nit, direccion, correo, resolucion) 
      VALUES (1, "MI EMPRESA S.A.S", "NIT 000.000.000-0", "Ciudad, País", "correo@empresa.com", "Resolución DIAN XXXXXX no definida aún.")
    `;
    
    connection.query(insertSQL, (err) => {
      if (err) throw err;
      console.log("Datos por defecto inyectados.");
      connection.end();
    });
  });
});


