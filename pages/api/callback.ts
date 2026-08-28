import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { pipeline } from 'stream/promises';
import { enforceRouteAvailability } from '@/utils/apiAvailability'

// On Fly the only writable, persistent path is the mounted volume at /data
// (the container runs as non-root `nextjs`, so process.cwd() -> /app is
// read-only). Default to it in production; use ./data for local `next dev`.
const DATA_ROOT =
    process.env.CALLBACK_DATA_DIR ||
    (process.env.NODE_ENV === 'production' ? '/data' : path.join(process.cwd(), 'data'));
const BASE_OUTPUT_DIR = path.join(DATA_ROOT, 'callback_OP');
const TEMP_DIR = path.join(DATA_ROOT, 'temp');

// Create lazily inside the handler, not at module load: a throw here takes the
// whole route down with a 500 on every request.
function ensureDirs() {
    fs.mkdirSync(BASE_OUTPUT_DIR, { recursive: true });
    fs.mkdirSync(TEMP_DIR, { recursive: true });
}

export const config = {
    api: {
        bodyParser: false,
        externalResolver: true,
        responseLimit: false,
    },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const routeAvailable = await enforceRouteAvailability(req, res)
    if (!routeAvailable) return

    if (req.method === 'POST') {
        const tempFilePath = path.join(TEMP_DIR, `temp_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.json`);

        try {
            ensureDirs();
            // 1. Stream the raw request body directly to a temporary file
            const writeStream = fs.createWriteStream(tempFilePath);
            await pipeline(req, writeStream);

            // 2. Read the file to extract recordId (only need the beginning of the file usually, but we'll read small chunks)
            // For simplicity, we'll read the whole thing now that it's on disk, but more safely than in-memory string concat
            const content = fs.readFileSync(tempFilePath, 'utf-8');
            let body;
            try {
                body = JSON.parse(content);
            } catch (e) {
                if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
                return res.status(400).send("Invalid JSON received");
            }

            const recordId = body?.responseSet?.[0]?.recordId;

            if (!recordId) {
                if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
                return res.status(400).send("No Record ID found in JSON");
            }

            const recordIdString = String(recordId);
            if (!/^[A-Za-z0-9_-]{1,64}$/.test(recordIdString)) {
                if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
                return res.status(400).send("Invalid Record ID format");
            }

            // 3. Create the specific folder for this Record ID
            const recordFolder = path.join(BASE_OUTPUT_DIR, `Record_${recordIdString}`);
            if (!fs.existsSync(recordFolder)) {
                fs.mkdirSync(recordFolder, { recursive: true });
            }

            // 4. Move temp file to final destination
            const uniqueId = crypto.randomBytes(3).toString('hex');
            const fileName = `${Date.now()}_${uniqueId}.json`;
            const finalPath = path.join(recordFolder, fileName);
            
            fs.renameSync(tempFilePath, finalPath);

            console.log(`[SAVED] Record ${recordId} -> ${fileName} (Size: ${content.length} bytes)`);
            return res.status(200).send(`Chunk saved in folder Record_${recordId}`);

        } catch (error) {
            console.error('Streaming Storage Error:', error);
            if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
            return res.status(500).send("Internal Server Error during upload");
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
