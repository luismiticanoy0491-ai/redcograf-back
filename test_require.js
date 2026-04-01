require('ts-node').register({ transpileOnly: true });
const separados = require('./src/routes/separados');
console.log("Separados export:", typeof separados, Object.keys(separados));
const ventas = require('./src/routes/ventas');
console.log("Ventas export:", typeof ventas, Object.keys(ventas));
