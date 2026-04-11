import express from "express";
import axios from "axios";
import { verifyTokenAndTenant } from "../middlewares/authMiddleware";

const router = express.Router();

// Ruta para envío directo de comprobantes por WhatsApp
router.post("/send", verifyTokenAndTenant, async (req: any, res: any) => {
  const { phone, message } = req.body;

  if (!phone || !message) {
    return res.status(400).json({ error: "Teléfono y mensaje son requeridos" });
  }

  try {
    const instanceId = process.env.WHATSAPP_INSTANCE_ID;
    const token = process.env.WHATSAPP_TOKEN;

    if (instanceId && token) {
      // INTEGRACIÓN REAL: Ejemplo con UltraMsg
      const url = `https://api.ultramsg.com/${instanceId}/messages/chat`;
      await axios.post(url, {
        token: token,
        to: phone,
        body: message,
        priority: 10
      });
      
      console.log(`[WHATSAPP API]: Mensaje enviado exitosamente a ${phone}`);
      return res.json({ success: true, message: "Mensaje enviado directo al celular." });
    } else {
      // MODO SIMULACIÓN: Si no hay llaves configuradas, solo logueamos en consola
      console.log("------------------------------------------");
      console.log(`[SIMULACIÓN WHATSAPP]: No se detectaron llaves API.`);
      console.log(`Para: ${phone}`);
      console.log(`Mensaje: ${message}`);
      console.log("------------------------------------------");
      
      return res.json({ 
        success: true, 
        simulated: true, 
        message: "Envío simulado. Configura WHATSAPP_TOKEN en .env para envíos reales." 
      });
    }
  } catch (error: any) {
    console.error("Error enviando WhatsApp:", error.response?.data || error.message);
    res.status(500).json({ error: "Error al procesar el envío de WhatsApp." });
  }
});

export default router;
