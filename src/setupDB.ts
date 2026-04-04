import mysql from "mysql2";

const connection = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "",
  multipleStatements: true
});

connection.connect((err: any) => {
  if (err) throw err;
  
  connection.query("CREATE DATABASE IF NOT EXISTS tienda_db", (err: any) => {
    if (err) throw err;
    connection.query("USE tienda_db", (err: any) => {
      if (err) throw err;
      
      const setupQueries = `
        SET FOREIGN_KEY_CHECKS = 0;
        DROP TABLE IF EXISTS pagos_suscripcion;
        DROP TABLE IF EXISTS usuarios_plataforma;
        DROP TABLE IF EXISTS pagos_empleados;
        DROP TABLE IF EXISTS ventas;
        DROP TABLE IF EXISTS abonos_separados;
        DROP TABLE IF EXISTS separados;
        DROP TABLE IF EXISTS facturas_venta;
        DROP TABLE IF EXISTS facturas_borrador;
        DROP TABLE IF EXISTS facturas_compra;
        DROP TABLE IF EXISTS productos;
        DROP TABLE IF EXISTS cajeros;
        DROP TABLE IF EXISTS clientes;
        DROP TABLE IF EXISTS empresas_suscritas;
        SET FOREIGN_KEY_CHECKS = 1;

        -- 1. Tablas Maestras (SaaS)
        CREATE TABLE empresas_suscritas (
          id INT AUTO_INCREMENT PRIMARY KEY,
          nombre_comercial VARCHAR(255) NOT NULL,
          nit VARCHAR(100) DEFAULT '',
          correo_contacto VARCHAR(100),
          telefono_contacto VARCHAR(50),
          fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          fecha_vencimiento_suscripcion DATE NOT NULL,
          estado VARCHAR(50) DEFAULT 'Trial',
          wompi_subscription_id VARCHAR(255) NULL
        );

        CREATE TABLE usuarios_plataforma (
          id INT AUTO_INCREMENT PRIMARY KEY,
          empresa_id INT NOT NULL,
          username VARCHAR(100) NOT NULL UNIQUE,
          password_hash VARCHAR(255) NOT NULL,
          role VARCHAR(50) DEFAULT 'dueño',
          FOREIGN KEY (empresa_id) REFERENCES empresas_suscritas(id) ON DELETE CASCADE
        );

        CREATE TABLE pagos_suscripcion (
          id INT AUTO_INCREMENT PRIMARY KEY,
          empresa_id INT NOT NULL,
          wompi_transaction_id VARCHAR(255) NOT NULL,
          monto DECIMAL(15,2) NOT NULL,
          fecha_pago TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          metodo_pago VARCHAR(100) DEFAULT 'Wompi',
          dias_agregados INT DEFAULT 30,
          FOREIGN KEY (empresa_id) REFERENCES empresas_suscritas(id) ON DELETE CASCADE
        );

        -- 2. Tablas de Tienda
        CREATE TABLE productos (
          id INT AUTO_INCREMENT PRIMARY KEY,
          empresa_id INT NOT NULL,
          referencia VARCHAR(100) DEFAULT '',
          nombre VARCHAR(255) NOT NULL,
          categoria VARCHAR(100) NOT NULL,
          cantidad INT NOT NULL DEFAULT 0,
          precio_compra DECIMAL(15,2) NOT NULL,
          porcentaje_ganancia DECIMAL(5,2) NOT NULL DEFAULT 40,
          precio_venta DECIMAL(15,2) NOT NULL,
          FOREIGN KEY (empresa_id) REFERENCES empresas_suscritas(id) ON DELETE CASCADE
        );

        CREATE TABLE cajeros (
          id INT AUTO_INCREMENT PRIMARY KEY,
          empresa_id INT NOT NULL,
          nombre VARCHAR(255) NOT NULL,
          documento VARCHAR(50),
          telefono VARCHAR(50) DEFAULT '',
          direccion VARCHAR(255) DEFAULT '',
          fecha_contrato DATE DEFAULT NULL,
          salario DECIMAL(15,2) DEFAULT 0.00,
          paga_comisiones BOOLEAN DEFAULT 0,
          porcentaje_comision DECIMAL(5,2) DEFAULT 0.00,
          FOREIGN KEY (empresa_id) REFERENCES empresas_suscritas(id) ON DELETE CASCADE
        );

        CREATE TABLE clientes (
          id INT AUTO_INCREMENT PRIMARY KEY,
          empresa_id INT NOT NULL,
          nombre VARCHAR(255) NOT NULL,
          documento VARCHAR(50),
          telefono VARCHAR(50),
          correo VARCHAR(100),
          FOREIGN KEY (empresa_id) REFERENCES empresas_suscritas(id) ON DELETE CASCADE
        );

        CREATE TABLE facturas_venta (
          id INT AUTO_INCREMENT PRIMARY KEY,
          empresa_id INT NOT NULL,
          cajero_id INT NULL,
          cliente_id INT NULL,
          total DECIMAL(15,2) NOT NULL,
          metodo_pago VARCHAR(50) NOT NULL,
          fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (empresa_id) REFERENCES empresas_suscritas(id) ON DELETE CASCADE,
          FOREIGN KEY (cajero_id) REFERENCES cajeros(id) ON DELETE SET NULL,
          FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE SET NULL
        );

        CREATE TABLE ventas (
          id INT AUTO_INCREMENT PRIMARY KEY,
          empresa_id INT NOT NULL,
          factura_id INT NOT NULL,
          producto_id INT,
          cantidad INT NOT NULL,
          precio_unitario DECIMAL(15,2) NOT NULL,
          FOREIGN KEY (empresa_id) REFERENCES empresas_suscritas(id) ON DELETE CASCADE,
          FOREIGN KEY (factura_id) REFERENCES facturas_venta(id) ON DELETE CASCADE,
          FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE SET NULL
        );

        CREATE TABLE pagos_empleados (
          id INT AUTO_INCREMENT PRIMARY KEY,
          empresa_id INT NOT NULL,
          cajero_id INT NOT NULL,
          mes INT NOT NULL,
          anio INT NOT NULL,
          salario_base DECIMAL(15,2) DEFAULT 0.00,
          comisiones DECIMAL(15,2) DEFAULT 0.00,
          total_pagado DECIMAL(15,2) DEFAULT 0.00,
          fecha_pago TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          metodo_pago VARCHAR(50) DEFAULT 'Efectivo',
          FOREIGN KEY (empresa_id) REFERENCES empresas_suscritas(id) ON DELETE CASCADE,
          FOREIGN KEY (cajero_id) REFERENCES cajeros(id) ON DELETE CASCADE
        );
        
        CREATE TABLE facturas_borrador (
          id INT AUTO_INCREMENT PRIMARY KEY,
          empresa_id INT NOT NULL,
          proveedor VARCHAR(255) DEFAULT '',
          numero_factura VARCHAR(100) DEFAULT '',
          fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          datos_json JSON NOT NULL,
          FOREIGN KEY (empresa_id) REFERENCES empresas_suscritas(id) ON DELETE CASCADE
        );

        CREATE TABLE facturas_compra (
          id INT AUTO_INCREMENT PRIMARY KEY,
          empresa_id INT NOT NULL,
          proveedor VARCHAR(255) DEFAULT '',
          numero_factura VARCHAR(100) DEFAULT '',
          fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          total DECIMAL(15,2) DEFAULT 0,
          datos_json JSON NOT NULL,
          FOREIGN KEY (empresa_id) REFERENCES empresas_suscritas(id) ON DELETE CASCADE
        );

        CREATE TABLE separados (
          id INT AUTO_INCREMENT PRIMARY KEY,
          empresa_id INT NOT NULL,
          cliente_id INT,
          fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          total DECIMAL(15,2) NOT NULL,
          saldo_pendiente DECIMAL(15,2) NOT NULL,
          estado VARCHAR(20) DEFAULT 'Pendiente', 
          detalles_json JSON NOT NULL,
          FOREIGN KEY (empresa_id) REFERENCES empresas_suscritas(id) ON DELETE CASCADE,
          FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE
        );

        CREATE TABLE abonos_separados (
          id INT AUTO_INCREMENT PRIMARY KEY,
          empresa_id INT NOT NULL,
          separado_id INT,
          fecha_abono TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          monto DECIMAL(15,2) NOT NULL,
          FOREIGN KEY (empresa_id) REFERENCES empresas_suscritas(id) ON DELETE CASCADE,
          FOREIGN KEY (separado_id) REFERENCES separados(id) ON DELETE CASCADE
        );

        -- Insertar Datos Default para el Entorno de Pruebas
        INSERT INTO empresas_suscritas (id, nombre_comercial, fecha_vencimiento_suscripcion, estado) 
        VALUES (1, 'Mi Tienda Inicial (SaaS)', DATE_ADD(CURRENT_DATE, INTERVAL 3650 DAY), 'Active');

        INSERT INTO productos (empresa_id, referencia, nombre, categoria, cantidad, precio_compra, porcentaje_ganancia, precio_venta) VALUES 
        (1, 'SKU-001', 'Producto Ejemplo 1', 'General', 10, 50000.00, 40, 70000.00);

        INSERT INTO cajeros (empresa_id, nombre, documento) VALUES (1, 'Admin Principal', '00000000');
        INSERT INTO clientes (empresa_id, nombre, documento, telefono) VALUES (1, 'Cliente General (Mostrador)', 'N/A', 'N/A');
      `;

      connection.query(setupQueries, (err: any) => {
        if (err) throw err;
        console.log("✅ Base de datos reconstruida 100% como arquitectura SAAS Multitienda (aislamiento por tenant).");
        connection.end();
      });
    });
  });
});

