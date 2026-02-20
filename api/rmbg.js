import { Client } from "@gradio/client";
import { Transform } from "stream";

// Helper: Throttles a stream to a specific bytes-per-second
class Throttle extends Transform {
  constructor(bps) {
    super();
    this.bps = bps;
  }

  _transform(chunk, encoding, callback) {
    // Calculate delay in ms based on chunk size
    const delay = (chunk.length / this.bps) * 1000;
    setTimeout(() => {
      this.push(chunk);
      callback();
    }, delay);
  }
}

export const config = {
  api: { bodyParser: false }
};

export default async function handler(req, res) {
  const SPEED_LIMIT = 50 * 1024; // 50 KB/s

  try {
    // --- 1. Throttled Input ---
    const inputThrottle = new Throttle(SPEED_LIMIT);
    req.pipe(inputThrottle);

    const chunks = [];
    for await (const chunk of inputThrottle) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);
    const blob = new Blob([buffer], { type: "image/png" });

    // --- 2. Process with Gradio ---
    const client = await Client.connect("briaai/BRIA-RMBG-2.0");
    const result = await client.predict("/image", { image: blob });
    
    const file = result.data[1];
    const imgResponse = await fetch(file.url);
    const imgArrayBuffer = await imgResponse.arrayBuffer();
    const finalBuffer = Buffer.from(imgArrayBuffer);

    // --- 3. Throttled Output ---
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Content-Length", finalBuffer.length);

    const outputThrottle = new Throttle(SPEED_LIMIT);
    outputThrottle.pipe(res);

    // Write the buffer to the throttle stream
    outputThrottle.write(finalBuffer);
    outputThrottle.end();

  } catch (e) {
    res.status(500).json({ error: e.toString() });
  }
}
