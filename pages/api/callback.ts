import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { pipeline } from 'stream/promises';
import { Transform } from 'stream';
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

// Upper bound on a single callback body. Default 1 GiB; override with
// CALLBACK_MAX_BODY_BYTES. Without this an unbounded upload fills the volume.
const MAX_BODY_BYTES = Number(process.env.CALLBACK_MAX_BODY_BYTES) || 1024 * 1024 * 1024;

// We only need responseSet[0].recordId to route the file into a folder.
// Reading the whole body to JSON.parse it OOMs the 1 GB VM well before 500 MB
// and hard-throws past V8's ~512 MB max string length — exactly the size where
// callbacks started failing. Read only the head and pull recordId from it.
const HEAD_BYTES = 64 * 1024;

// GET inlines each stored body's parsed JSON. Above this, return metadata only
// so one big record can't OOM the read-back. Override with CALLBACK_GET_INLINE_MAX_BYTES.
const GET_INLINE_MAX_BYTES = Number(process.env.CALLBACK_GET_INLINE_MAX_BYTES) || 8 * 1024 * 1024;

async function extractRecordIdFromHead(filePath: string): Promise<string | null> {
    const fd = await fs.promises.open(filePath, 'r');
    try {
        const buf = Buffer.alloc(HEAD_BYTES);
        const { bytesRead } = await fd.read(buf, 0, HEAD_BYTES, 0);
        const head = buf.subarray(0, bytesRead).toString('utf-8');
        try {
            const id = (JSON.parse(head) as any)?.responseSet?.[0]?.recordId;
            if (id != null) return String(id);
        } catch {
            // Big body: the head is a truncated slice so a full parse fails.
            // recordId sits near the front of the documented shape — scan for it.
        }
        const match = head.match(/"recordId"\s*:\s*"?([A-Za-z0-9_-]{1,64})"?/);
        return match ? match[1] : null;
    } finally {
        await fd.close();
    }
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

            // Reject oversize uploads before they fill the volume. Chunked
            // senders omit Content-Length, so also count bytes mid-stream.
            const declaredLength = Number(req.headers['content-length']);
            if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
                return res.status(413).send('Payload too large');
            }
            let receivedBytes = 0;
            const limiter = new Transform({
                transform(chunk, _enc, cb) {
                    receivedBytes += chunk.length;
                    if (receivedBytes > MAX_BODY_BYTES) {
                        cb(Object.assign(new Error('Payload too large'), { statusCode: 413 }));
                        return;
                    }
                    cb(null, chunk);
                },
            });

            // Stream the raw body straight to disk — never buffer it in memory.
            await pipeline(req, limiter, fs.createWriteStream(tempFilePath));

            const recordIdString = await extractRecordIdFromHead(tempFilePath);
            if (!recordIdString || !/^[A-Za-z0-9_-]{1,64}$/.test(recordIdString)) {
                await fs.promises.rm(tempFilePath, { force: true });
                return res.status(400).send('No valid Record ID found in JSON');
            }

            const recordFolder = path.join(BASE_OUTPUT_DIR, `Record_${recordIdString}`);
            fs.mkdirSync(recordFolder, { recursive: true });

            const fileName = `${Date.now()}_${crypto.randomBytes(3).toString('hex')}.json`;
            const finalPath = path.join(recordFolder, fileName);
            fs.renameSync(tempFilePath, finalPath);

            console.log(`[SAVED] Record ${recordIdString} -> ${fileName} (${receivedBytes} bytes)`);
            return res.status(200).send(`Chunk saved in folder Record_${recordIdString}`);

        } catch (error) {
            await fs.promises.rm(tempFilePath, { force: true }).catch(() => {});
            if ((error as { statusCode?: number })?.statusCode === 413) {
                return res.status(413).send('Payload too large');
            }
            console.error('Streaming Storage Error:', error);
            return res.status(500).send('Internal Server Error during upload');
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
                    const filePath = path.join(recordPath, file);
                    const sizeBytes = fs.statSync(filePath).size;
                    // Inlining a few-hundred-MB body here OOMs the process the
                    // same way the POST path did. Only inline what's safe to
                    // parse; point at the folder on disk for the rest.
                    if (sizeBytes > GET_INLINE_MAX_BYTES) {
                        return { fileName: file, sizeBytes, data: null, truncated: true };
                    }
                    const content = fs.readFileSync(filePath, 'utf-8');
                    return { fileName: file, sizeBytes, data: JSON.parse(content), truncated: false };
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
