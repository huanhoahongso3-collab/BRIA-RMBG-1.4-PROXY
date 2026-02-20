import { Client } from "@gradio/client";

// Helper for artificial delay
const delay = (ms) => new Promise(res => setTimeout(res, ms));

export const config = {
  api: { bodyParser: false }
};

export default async function handler(req, res) {
  // Fix for the 405 error: Log what method is actually hitting the server
  if (req.method !== "POST") {
    console.log("Received method:", req.method);
    return res.status(405).json({ error: `Expected POST, got ${req.method}` });
  }

  try {
    // 1. Collect input (Input "Throttling" by waiting)
    const chunks = [];
    for await (const chunk of req) { chunks.push(chunk); }
    const buffer = Buffer.concat(chunks);
    
    await delay(2000); // Wait 2 seconds

    // 2. AI Processing
    const client = await Client.connect("briaai/BRIA-RMBG-2.0");
    const result = await client.predict("/image", { 
      image: new Blob([buffer], { type: "image/png" }) 
    });

    // 3. Prepare Output
    const file = result.data[1];
    const imgResponse = await fetch(file.url);
    const finalBuffer = Buffer.from(await imgResponse.arrayBuffer());

    await delay(2000); // Wait another 2 seconds

    // 4. Send response
    res.setHeader("Content-Type", "image/png");
    res.send(finalBuffer);

  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
}
