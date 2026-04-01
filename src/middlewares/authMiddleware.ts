const jwt = require('jsonwebtoken');

export const verifyTokenAndTenant = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(403).json({ error: 'Token es requerido' });
  }

  const token = authHeader.split(' ')[1]; // "Bearer token..."
  if (!token) return res.status(403).json({ error: 'Token inválido' });

  jwt.verify(token, process.env.JWT_SECRET || 'super_secret_key_development', (err: any, decoded: any) => {
    if (err) {
      return res.status(401).json({ error: 'Token expirado o inválido' });
    }

    req.user = decoded; // { id, role, username, empresa_id }
    
    // Si la ruta no es super-admin, requerimos empresa_id
    if (decoded.role !== 'superadmin' && !decoded.empresa_id) {
       return res.status(401).json({ error: 'Usuario incompatible con arquitectura SaaS (Sin Empresa Asignada)'});
    }

    next();
  });
};
