const mysql = require("mysql2");

const connection = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "",
  database: "tienda_db"
});

connection.query(
  "DELETE FROM productos WHERE categoria IN ('Computadoras', 'Audio', 'Monitores', 'Periféricos', 'Tablets', 'Componentes')",
  (err, results) => {
    if (err) console.error(err);
    else console.log(`✅ Eliminados ${results.affectedRows} productos de categoría de prueba antiguos.`);
    connection.end();
  }
);

export {};
