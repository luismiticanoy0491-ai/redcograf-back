
import axios from "axios";
import jwt from "jsonwebtoken";

async function testFetch() {
  const secret = 'your_jwt_secret_key';
  const token = jwt.sign({ id: 1, role: 'dueño', empresa_id: 1 }, secret);

  try {
    console.log("Testing GET /productos...");
    const res = await axios.get("http://localhost:4000/productos", {
        headers: { Authorization: `Bearer ${token}` }
    });
    console.log(`Success! Found ${res.data.length} products.`);
  } catch (err: any) {
    console.error("Fetch failed:", err.response?.status, err.response?.data || err.message);
  }
}

testFetch();
