require('dotenv').config();

const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.use("/productos", require("./routes/productos"));
app.use("/ventas", require("./routes/ventas"));
app.use("/borradores", require("./routes/borradores"));
app.use("/cajeros", require("./routes/cajeros"));
app.use("/clientes", require("./routes/clientes"));
app.use("/proveedores", require("./routes/proveedores"));
app.use("/reportes", require("./routes/reportes"));
app.use("/empresa", require("./routes/empresa"));
app.use("/backup", require("./routes/backup"));
app.use("/compras", require("./routes/compras"));
app.use("/dashboard", require("./routes/dashboard"));
app.use("/pagos", require("./routes/pagos"));
app.use("/ai", require("./routes/ai"));
app.use("/auth", require("./routes/auth"));
app.use("/separados", require("./routes/separados"));
app.use("/suscripciones", require("./routes/pagosSaaS"));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
export {};
