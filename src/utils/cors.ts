import { NextApiRequest, NextApiResponse } from 'next';

// For production, use environment variable or specific domains
export const corsWithWhitelist = async (req: NextApiRequest, res: NextApiResponse) => {
  // In production, replace with your actual frontend URL
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
    'http://localhost:3000',
    'http://localhost:3001', 
    'http://localhost:5173', // Vite default port
    'https://angaadi.vercel.app', // Your frontend domain
    'https://your-frontend-domain.vercel.app', // Add your actual frontend domain here
    'https://your-frontend-vercel.app' // Add your actual frontend domain here
  ];
  
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    // For non-matching origins in development, allow all; in production use a specific domain
    if (process.env.NODE_ENV === 'development') {
      res.setHeader('Access-Control-Allow-Origin', '*');
    } else {
      // In production, it's better to specify the exact origin rather than wildcard
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