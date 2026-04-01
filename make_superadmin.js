const mysql = require("mysql2");

const connection = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "",
  database: "tienda_db"
});

connection.connect((err) => {
  if (err) {
    console.error("Error conectando a la BD:", err);
    process.exit(1);
  }
  
  const query = "UPDATE usuarios_plataforma SET role = 'superadmin' WHERE username = 'redcograf'";
  
  connection.query(query, (error, results) => {
    if (error) {
      console.error("Error al actualizar:", error);
      process.exit(1);
    }
    console.log(`¡Éxito! Filas afectadas: ${results.affectedRows}`);
    connection.end();
  });
});
