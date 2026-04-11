import connection from "./conection";

const sql = process.argv[2];

if (!sql) {
  console.log("Por favor envía una consulta SQL como argumento.");
  process.exit();
}

connection.query(sql, (err, results) => {
  if (err) {
    console.error("SQL ERROR:", err);
  } else {
    console.log("SQL SUCCESS:");
    console.log(JSON.stringify(results, null, 2));
  }
  process.exit();
});
