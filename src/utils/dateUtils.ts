/**
 * Utilidades para manejo de fechas en zona horaria Colombia (America/Bogota)
 */

export const getColombiaDate = () => {
  // Como process.env.TZ está seteado en server.ts, new Date() ya trabaja en hora local del proceso.
  // Sin embargo, para asegurar el formato YYYY-MM-DD HH:mm:ss sin desplazamientos:
  const now = new Date();
  
  // Ajuste manual por si el entorno ignora process.env.TZ (algunos hosts restringidos)
  // Colombia es UTC-5 siempre (no tiene horario de verano)
  const offset = -5;
  const colombiaTime = new Date(now.getTime() + (offset * 60 * 60 * 1000) + (now.getTimezoneOffset() * 60000));
  
  return colombiaTime;
};

export const formatColombiaDate = (date: Date = new Date()) => {
  const d = new Date(date.getTime() + (-5 * 60 * 60 * 1000) + (date.getTimezoneOffset() * 60000));
  const pad = (n: number) => n.toString().padStart(2, '0');
  
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const min = pad(d.getMinutes());
  const ss = pad(d.getSeconds());
  
  return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
};

export const getColombiaISODate = (date: Date = new Date()) => {
  const d = new Date(date.getTime() + (-5 * 60 * 60 * 1000) + (date.getTimezoneOffset() * 60000));
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
