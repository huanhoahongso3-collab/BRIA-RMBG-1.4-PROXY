import { Client } from "@gradio/client";

export const config = {
  api: {
    bodyParser: false
  }
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }

  try {
    const buffer = await new Promise((resolve, reject) => {
      const chunks = [];
      req.on("data", (chunk) => chunks.push(chunk));
      req.on("end", () => resolve(Buffer.concat(chunks)));
      req.on("error", reject);
    });

    // 1. Connect to the specific 1.4 replica
    const app = await Client.connect("https://briaai-bria-rmbg-1-4.hf.space/--replicas/bpgvg/");

    // 2. Convert to Blob
    const imageBlob = new Blob([buffer], { type: "image/png" });

    // 3. Predict using the positional array [image]
    const result = await app.predict("/predict", [
      imageBlob, 
    ]);

    // 4. Robust Output Detection
    // Some Gradio versions return result.data[0].url, others result.data[0].path
    const outputField = result.data[0];
    const imageUrl = outputField?.url || outputField?.path || (typeof outputField === 'string' ? outputField : null);

    if (imageUrl) {
      // 5. Fetch the result
      // If it's a relative path, Gradio Client usually prefixes it, but we check here
      const finalUrl = imageUrl.startsWith('http') ? imageUrl : `https://briaai-bria-rmbg-1-4.hf.space/file=${imageUrl}`;
      
      const imageResponse = await fetch(finalUrl);
      const imageArrayBuffer = await imageResponse.arrayBuffer();

      res.setHeader("Content-Type", "image/png");
      return res.status(200).send(Buffer.from(imageArrayBuffer));
    } else {
      // Log the actual structure to your server console so you can see what the API sent back
      console.log("Unexpected API Response Structure:", JSON.stringify(result.data));
      throw new Error("No image URL or path found in model response.");
    }

  } catch (err) {
    console.error("Worker Error:", err);
    res.status(500).json({ 
      error: "Background removal failed", 
      message: err.message,
      // Useful for debugging:
      stage: "prediction_or_parsing"
    });
  }
}
