import mysql from 'mysql2';
const connection = mysql.createConnection({ host: 'localhost', user: 'root', password: '', database: 'tienda_db' });
const query = `
CREATE TABLE IF NOT EXISTS facturas_compra (
    id INT AUTO_INCREMENT PRIMARY KEY,
    proveedor VARCHAR(255) DEFAULT '',
    numero_factura VARCHAR(100) DEFAULT '',
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    total DECIMAL(15,2) DEFAULT 0,
    datos_json JSON NOT NULL
)
`;
connection.query(query, (err) => {
    if (err) console.error(err);
    else console.log('Table facturas_compra created successfully');
    connection.end();
});


