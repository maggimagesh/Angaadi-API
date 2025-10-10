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
  
  // Debug logging for production
  console.log(`CORS Debug - Origin: ${origin}, NODE_ENV: ${process.env.NODE_ENV}, Allowed Origins: ${allowedOrigins.join(', ')}`);

  // In development, allow all origins for easier development
  if (process.env.NODE_ENV === 'development') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    console.log('CORS: Development mode - allowing all origins');
  } else {
    // In production, only allow specific origins
    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Origin', origin);
      console.log(`CORS: Production mode - allowing origin: ${origin}`);
    } else {
      // If origin doesn't match, don't set Access-Control-Allow-Origin
      // This will cause CORS to fail, which is the desired behavior for security
      console.warn(`CORS: Origin ${origin} not allowed. Allowed origins: ${allowedOrigins.join(', ')}`);
      res.setHeader('Access-Control-Allow-Origin', 'null');
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