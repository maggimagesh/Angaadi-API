import { NextApiRequest, NextApiResponse } from 'next';

// For production, use environment variable or specific domains
export const corsWithWhitelist = async (req: NextApiRequest, res: NextApiResponse) => {
  // In production, replace with your actual frontend URL
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3300',
    'http://localhost:5173',
    'https://angaadi.vercel.app',
    'https://angaadi.online'
  ];
  
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
    } else {
      res.setHeader('Access-Control-Allow-Origin', allowedOrigins[0] || '');
    }
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return false;
  }

  return true;
};