import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import productos from "./routes/productos";
import ventas from "./routes/ventas";
import borradores from "./routes/borradores";
import cajeros from "./routes/cajeros";
import clientes from "./routes/clientes";
import proveedores from "./routes/proveedores";
import reportes from "./routes/reportes";
import empresa from "./routes/empresa";
import backup from "./routes/backup";
import compras from "./routes/compras";
import dashboard from "./routes/dashboard";
import pagos from "./routes/pagos";
import ai from "./routes/ai";
import auth from "./routes/auth";
import separados from "./routes/separados";
import pagosSaaS from "./routes/pagosSaaS";
import kardex from "./routes/kardex";
import whatsapp from "./routes/whatsapp";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.use("/productos", productos);
app.use("/ventas", ventas);
app.use("/borradores", borradores);
app.use("/cajeros", cajeros);
app.use("/clientes", clientes);
app.use("/proveedores", proveedores);
app.use("/reportes", reportes);
app.use("/empresa", empresa);
app.use("/backup", backup);
app.use("/compras", compras);
app.use("/dashboard", dashboard);
app.use("/pagos", pagos);
app.use("/ai", ai);
app.use("/auth", auth);
app.use("/separados", separados);
app.use("/suscripciones", pagosSaaS);
app.use("/kardex", kardex);
app.use("/whatsapp", whatsapp);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
