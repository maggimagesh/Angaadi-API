import { NextApiRequest, NextApiResponse } from 'next';

// For production, use environment variable or specific domains
export const corsWithWhitelist = async (req: NextApiRequest, res: NextApiResponse) => {
  const defaultOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3300',
    'http://localhost:5173',
    'https://angaad.online',
    'https://www.angaad.online',
    'https://angaadi.vercel.app',
    'https://angaadi.online',
    'https://www.angaadi.online'
  ];
  
  const allowedOrigins = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
    : defaultOrigins;
  
  const origin = req.headers.origin;

  // Set common headers
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours

  // In development, allow all origins
  if (process.env.NODE_ENV === 'development') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  } else {
    // In production, only allow whitelisted origins
    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
    // If the origin is not in the list, the header is NOT set.
    // The browser will then correctly block the request. This is the desired behavior.
  }
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return false; // Stop further execution
  }

  return true; // Continue to the API route handler
};
