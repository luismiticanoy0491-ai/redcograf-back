import jwt from 'jsonwebtoken';

export const verifyTokenAndTenant = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(403).json({ error: 'Token es requerido' });
  }

  const token = authHeader.split(' ')[1]; // "Bearer token..."
  if (!token) return res.status(403).json({ error: 'Token inválido' });

  if (!process.env.JWT_SECRET) {
    console.error("CRITICAL ERROR: JWT_SECRET environment variable is not defined!");
    return res.status(500).json({ error: "Configuración de seguridad incompleta en el servidor." });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err: any, decoded: any) => {
    if (err) {
      return res.status(401).json({ error: 'Token expirado o inválido' });
    }

    // Seguridad SaaS activa: Ya no permitimos tokens sin empresa_id (excepto superadmins si aplica)
    if (!decoded.empresa_id && decoded.role !== 'superadmin') {
       return res.status(401).json({ error: 'Token no contiene identificación de empresa (Tenant ID missing)'});
    }
    
    req.user = decoded; // { id, role, username, empresa_id }

    next();
  });
};

/**
 * Middleware para rutas críticas de SuperAdministrador SaaS.
 * Restringe el acceso únicamente a usuarios con rol 'superadmin' 
 * que pertenezcan a la Empresa Matriz (ID 1).
 */
export const verifySuperAdmin = (req: any, res: any, next: any) => {
  verifyTokenAndTenant(req, res, () => {
    if (req.user.role === 'superadmin' && parseInt(req.user.empresa_id) === 1) {
      next();
    } else {
      console.warn(`[INTENTO ACCESO SUPERADMIN]: Usuario ${req.user.username} intentó acceder sin privilegios suficientes.`);
      res.status(403).json({ 
        error: "Acceso Denegado. No autorizado. Requiere rol superadmin y pertenecer a la empresa autorizada." 
      });
    }
  });
};
