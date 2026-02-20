import { Client } from "@gradio/client";
import { Readable } from "stream";

export const config = {
  api: {
    bodyParser: false
  }
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // 1. Collect the incoming stream
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);
    const blob = new Blob([buffer], { type: "image/png" });

    // 2. Connect and Predict
    const client = await Client.connect("briaai/BRIA-RMBG-2.0");
    const result = await client.predict("/image", { image: blob });

    // 3. Fetch the result image
    const file = result.data[1];
    const imgResponse = await fetch(file.url);
    const imgArrayBuffer = await imgResponse.arrayBuffer();
    const finalBuffer = Buffer.from(imgArrayBuffer);

    // --- 4. Throttling Logic (50 KB/s) ---
    const SPEED_BPS = 50 * 1024; // 50 KB in bytes
    const CHUNK_SIZE = 16384;    // 16 KB chunks for smoother delivery
    let offset = 0;

    res.setHeader("Content-Type", "image/png");
    res.setHeader("Content-Length", finalBuffer.length);

    const throttleStream = new Readable({
      read() {
        if (offset >= finalBuffer.length) {
          this.push(null); // End of stream
          return;
        }

        const end = Math.min(offset + CHUNK_SIZE, finalBuffer.length);
        const chunk = finalBuffer.slice(offset, end);
        offset = end;

        // Calculate delay: (bytes / bytes_per_second) * 1000ms
        const delay = (chunk.length / SPEED_BPS) * 1000;

        setTimeout(() => {
          this.push(chunk);
        }, delay);
      }
    });

    throttleStream.pipe(res);

  } catch (e) {
    console.error(e);
    if (!res.headersSent) {
      res.status(500).json({ error: e.toString() });
    }
  }
}
