import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const BASE_OUTPUT_DIR = path.join(process.cwd(), 'data', 'callback_OP');

export const config = {
    api: {
        bodyParser: false,
        externalResolver: true,
    },
};

const getRawBody = (req: any): Promise<string> => {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', (chunk: Buffer) => {
            body += chunk.toString();
        });
        req.on('end', () => {
            resolve(body);
        });
        req.on('error', (err: any) => {
            reject(err);
        });
    });
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'POST') {
        try {
            const rawBody = await getRawBody(req);
            let body;
            try {
                body = JSON.parse(rawBody);
            } catch (e) {
                return res.status(400).send("Invalid JSON");
            }
            
            const recordId = body?.responseSet?.[0]?.recordId;

            if (!recordId) {
                return res.status(400).send("No Record ID found");
            }

            // 1. Create the specific folder for this Record ID
            const recordFolder = path.join(BASE_OUTPUT_DIR, `Record_${recordId}`);
            if (!fs.existsSync(recordFolder)) {
                fs.mkdirSync(recordFolder, { recursive: true });
            }

            // 2. Generate a unique filename for this chunk
            const timestamp = Date.now();
            const uniqueId = crypto.randomBytes(3).toString('hex');
            const fileName = `${timestamp}_${uniqueId}.json`;
            const filePath = path.join(recordFolder, fileName);

            // 3. Store the data
            fs.writeFileSync(filePath, JSON.stringify(body, null, 4));

            console.log(`[SAVED] Record ${recordId} -> ${fileName}`);
            return res.status(200).send(`Chunk saved in folder Record_${recordId}`);

        } catch (error) {
            console.error('Storage Error:', error);
            return res.status(500).send("Internal Server Error");
        }
    } else if (req.method === 'GET') {
        try {
            if (!fs.existsSync(BASE_OUTPUT_DIR)) {
                return res.status(200).json({ message: "No callback data stored yet.", records: [] });
            }

            const records = fs.readdirSync(BASE_OUTPUT_DIR).filter(item => fs.statSync(path.join(BASE_OUTPUT_DIR, item)).isDirectory());
            
            const result: any[] = [];
            for (const record of records) {
                const recordPath = path.join(BASE_OUTPUT_DIR, record);
                const files = fs.readdirSync(recordPath).filter(file => file.endsWith('.json'));
                const fileData = files.map(file => {
                    const content = fs.readFileSync(path.join(recordPath, file), 'utf-8');
                    return { fileName: file, data: JSON.parse(content) };
                });
                result.push({ recordName: record, files: fileData });
            }

            return res.status(200).json(result);
        } catch (error) {
            console.error('Retrieval Error:', error);
            return res.status(500).send("Internal Server Error");
        }
    } else {
        res.setHeader('Allow', ['POST', 'GET']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
    }
}
