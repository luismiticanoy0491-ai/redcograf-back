import express from "express";
import connection from "../conection";

const router = express.Router();

// 1. Obtener el historial de facturas de compra
router.get("/", (req, res) => {
  connection.query("SELECT * FROM facturas_compra ORDER BY fecha DESC", (err: any, results: any[]) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Error obteniendo facturas de compra" });
    }
    const facturas = results.map(r => ({
      ...r,
      datos_json: typeof r.datos_json === 'string' ? JSON.parse(r.datos_json) : r.datos_json
    }));
    res.json(facturas);
  });
});

// 2. Registrar una NUEVA factura de compra (Ingreso original)
router.post("/", async (req, res) => {
  const { proveedor, numero_factura, total, productos } = req.body;
  if (!Array.isArray(productos) || productos.length === 0) {
    return res.status(400).json({ error: "No se proporcionaron productos válidos." });
  }

  const promiseDb = connection.promise();
  try {
    // A) Actualizar el inventario físico (similar al antiguo /productos/batch)
    for (const p of productos) {
      if (p.inyectado) {
        // Si ya fue inyectado cuando era borrador, no lo volvemos a sumar.
        continue;
      }

      if (p.referencia && p.referencia.trim() !== '') {
        const [existing]: any = await promiseDb.query("SELECT id FROM productos WHERE referencia = ? ORDER BY id DESC LIMIT 1", [p.referencia]);
        
        if (existing.length > 0) {
          // Si existe, suma la cantidad e iguala los precios actuales a la nueva compra
          await promiseDb.query(
            "UPDATE productos SET cantidad = cantidad + ?, precio_compra = ?, precio_venta = ?, porcentaje_ganancia = ? WHERE id = ?",
            [p.cantidad, p.precio_compra, p.precio_venta, p.porcentaje_ganancia, existing[0].id]
          );
          continue;
        }
      }
      // Si no existe, lo creamos como nuevo
      await promiseDb.query(
        "INSERT INTO productos (referencia, nombre, categoria, cantidad, precio_compra, porcentaje_ganancia, precio_venta) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [p.referencia || '', p.nombre, p.categoria, p.cantidad, p.precio_compra, p.porcentaje_ganancia, p.precio_venta]
      );
      
      p.inyectado = true; // Actualizamos estado porsiaca
    }
    
    // B) Guardar el Ticket de Compra para el Historial
    const insertQuery = "INSERT INTO facturas_compra (proveedor, numero_factura, total, datos_json) VALUES (?, ?, ?, ?)";
    const [result]: any = await promiseDb.query(insertQuery, [proveedor || '', numero_factura || '', total || 0, JSON.stringify(productos)]);

    res.status(201).json({ message: "Factura registrada y stock sumado correctamente", id: result.insertId });
  } catch (err) {
    console.error("Error al registrar compra:", err);
    res.status(500).json({ error: "Error actualizando el inventario por lotes" });
  }
});

// 3. EDITAR una factura histórica (Revertir y aplicar nuevos deltas de inventario)
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { proveedor, numero_factura, total, productos } = req.body;
  
  if (!Array.isArray(productos) || productos.length === 0) {
    return res.status(400).json({ error: "Inventario inválido" });
  }

  const promiseDb = connection.promise();
  try {
    // A) Extraer la factura vieja original para deshacer su efecto matemático
    const [oldRows]: any = await promiseDb.query("SELECT datos_json FROM facturas_compra WHERE id = ?", [id]);
    if (oldRows.length === 0) return res.status(404).json({ error: "Factura no encontrada" });
    
    const oldProducts = typeof oldRows[0].datos_json === 'string' 
      ? JSON.parse(oldRows[0].datos_json) 
      : oldRows[0].datos_json;

    // B) Revertir (restar) las cantidades originales del inventario físico
    for (const oldP of oldProducts) {
       // Buscar por referencia para restar el stock que habíamos ingresado
       if (oldP.referencia) {
         await promiseDb.query(
           "UPDATE productos SET cantidad = cantidad - ? WHERE referencia = ? ORDER BY id DESC LIMIT 1", 
           [oldP.cantidad, oldP.referencia]
         );
       } else if (oldP.nombre) {
         // Fallback por si la referencia era nula
         await promiseDb.query(
           "UPDATE productos SET cantidad = cantidad - ? WHERE nombre = ? ORDER BY id DESC LIMIT 1", 
           [oldP.cantidad, oldP.nombre]
         );
       }
    }

    // C) Aplicar la NUEVA carga del inventario (como un ingreso en lote nuevo)
    for (const newP of productos) {
      let productId = null;
      let existing: any[] = [];
      
      if (newP.referencia && newP.referencia.trim() !== '') {
         const [res]: any = await promiseDb.query("SELECT id FROM productos WHERE referencia = ? ORDER BY id DESC LIMIT 1", [newP.referencia]);
         existing = res;
      } else {
         const [res]: any = await promiseDb.query("SELECT id FROM productos WHERE nombre = ? ORDER BY id DESC LIMIT 1", [newP.nombre]);
         existing = res;
      }

      if (existing.length > 0) {
        // Encontramos el producto: sumamos su nueva cantidad (editada) y sobreescribimos los costos maestros
        await promiseDb.query(
          "UPDATE productos SET cantidad = cantidad + ?, precio_compra = ?, precio_venta = ?, porcentaje_ganancia = ? WHERE id = ?",
          [newP.cantidad, newP.precio_compra, newP.precio_venta, newP.porcentaje_ganancia, existing[0].id]
        );
      } else {
        // Si durante la edición el usuario "añadió un producto nuevo" inédito en DB
        await promiseDb.query(
          "INSERT INTO productos (referencia, nombre, categoria, cantidad, precio_compra, porcentaje_ganancia, precio_venta) VALUES (?, ?, ?, ?, ?, ?, ?)",
          [newP.referencia || '', newP.nombre, newP.categoria || 'Sin Categoría', newP.cantidad, newP.precio_compra, newP.porcentaje_ganancia, newP.precio_venta]
        );
      }
    }

    // D) Sobreescribir el ticket original de la factura para reflejar la realidad editada
    const updateQuery = "UPDATE facturas_compra SET proveedor=?, numero_factura=?, total=?, datos_json=?, fecha=CURRENT_TIMESTAMP WHERE id=?";
    await promiseDb.query(updateQuery, [proveedor || '', numero_factura || '', total || 0, JSON.stringify(productos), id]);

    res.json({ message: "Factura y stock reajustado con éxito" });

  } catch (err) {
    console.error("Error al reescribir la factura invertida:", err);
    res.status(500).json({ error: "Hubo un error calculando el Delta de inventario en reversa." });
  }
});

export default router;
