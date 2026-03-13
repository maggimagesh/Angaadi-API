import { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  // Simulate an infinite loop by setting the status code to 508 Loop Detected
  // This status code is defined in RFC 5842.
  res.status(508).json({
    status: 'Loop Detected',
    code: 508,
    message: 'The server detected an infinite loop while processing the request.',
    hint: 'Check your request headers or parameters for circular references.'
  });
}
