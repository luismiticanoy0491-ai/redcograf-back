import connection from "./conection";

connection.query("SELECT * FROM kardex ORDER BY id DESC LIMIT 10", (err, results) => {
  if (err) {
    console.error(err);
  } else {
    console.log("LAST KARDEX ENTRIES:");
    console.log(JSON.stringify(results, null, 2));
  }
  process.exit();
});
