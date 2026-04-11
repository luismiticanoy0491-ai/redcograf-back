import connection from "../conection";

/**
 * Registra un movimiento en el Kardex.
 * Puede opcionalmente recibir una conexion de pool activa para participar en una transacción.
 */
export async function registrarKardexTransaccional(
  conn: any, // Connection from pool or transaction
  producto_id: number,
  empresa_id: number,
  tipo: 'ENTRADA' | 'SALIDA' | 'AJUSTE',
  cantidad_antes: number,
  cantidad_modificada: number, // Valor absoluto (la cantidad que se movio)
  cantidad_despues: number,
  motivo: string,
  referencia: string = "",
  usuario_nombre: string = "Sistema"
) {
  const query = `
    INSERT INTO kardex 
    (producto_id, empresa_id, tipo_movimiento, cantidad_antes, cantidad_modificada, cantidad_despues, motivo, referencia, usuario_nombre) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  
  return new Promise((resolve, reject) => {
    conn.query(
      query,
      [producto_id, empresa_id, tipo, cantidad_antes, Math.abs(cantidad_modificada), cantidad_despues, motivo, referencia, usuario_nombre],
      (err: any, results: any) => {
        if (err) return reject(err);
        resolve(results);
      }
    );
  });
}
