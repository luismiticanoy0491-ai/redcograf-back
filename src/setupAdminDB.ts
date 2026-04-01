const connection = require('./conection');
const bcrypt = require('bcryptjs');

const createTableQuery = `
  CREATE TABLE IF NOT EXISTS administradores (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'admin',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`;

connection.query(createTableQuery, async (err) => {
  if (err) {
    console.error("Error creando tabla administradores:", err);
    process.exit(1);
  }
  
  console.log("Tabla 'administradores' verificada/creada.");

  // Verificar si ya existe el usuario 'admin'
  connection.query("SELECT * FROM administradores WHERE username = 'admin'", async (err, results) => {
    if (err) {
      console.error("Error verificando usuario admin:", err);
      process.exit(1);
    }

    if (results.length === 0) {
      // Crear el usuario admin por defecto con contraseña 'admin123'
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash('admin123', salt);
      
      const insertQuery = "INSERT INTO administradores (username, password_hash) VALUES (?, ?)";
      connection.query(insertQuery, ['admin', hash], (err) => {
        if (err) {
          console.error("Error insertando usuario admin:", err);
        } else {
          console.log("Usuario 'admin' creado exitosamente. Contraseña por defecto: 'admin123'");
        }
        process.exit(0);
      });
    } else {
      console.log("El usuario 'admin' ya existe en la base de datos.");
      process.exit(0);
    }
  });
});


export {};
