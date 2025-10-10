import { NextApiRequest, NextApiResponse } from 'next';

// For production, use environment variable or specific domains
export const corsWithWhitelist = async (req: NextApiRequest, res: NextApiResponse) => {
  // Default allowed origins - add your production domains here
  const defaultOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3300',
    'http://localhost:5173',
    'https://angaadi.vercel.app',
    'https://angaadi.online',
    'https://www.angaadi.online'
  ];
  
  // Get allowed origins from environment variable or use defaults
  const allowedOrigins = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
    : defaultOrigins;
  
  const origin = req.headers.origin;

  // In development, allow all origins for easier development
  if (process.env.NODE_ENV === 'development') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  } else {
    // In production, only allow specific origins
    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Origin', origin);
    } else if (!origin) {
      // Handle requests without origin (like server-to-server or some mobile apps)
      res.setHeader('Access-Control-Allow-Origin', '*');
    } else {
      // If origin doesn't match, allow the first default origin as fallback
      // This prevents complete blocking while maintaining some security
      const fallbackOrigin = allowedOrigins[0] || 'https://angaadi.online';
      res.setHeader('Access-Control-Allow-Origin', fallbackOrigin);
    }
  }
  
  // Always set these headers for all requests
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return false;
  }

  return true;
};