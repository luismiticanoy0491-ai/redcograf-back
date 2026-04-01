const axios = require('axios');

async function testRegistration() {
  try {
    const response = await axios.post('http://localhost:4000/auth/registro-empresa', {
      nombre_comercial: 'Test Error',
      username: 'luistest123',
      password: 'password123'
    });
    console.log("ÉXITO:", response.data);
  } catch (error) {
    if (error.response) {
      console.log("STATUS:", error.response.status);
      console.log("HEADERS:", error.response.headers);
      console.log("DATA ERROR:", JSON.stringify(error.response.data).substring(0, 200));
    } else {
      console.log("NETWORK ERROR:", error.message);
    }
  }
}

testRegistration();
