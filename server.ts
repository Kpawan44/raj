import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API route
  app.post("/api/forecast", async (req, res) => {
    try {
      const { jobCards, movements } = req.body;
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("GEMINI_API_KEY is not defined");
      }
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const prompt = `Analyze the following job cards and historical movements to estimate job completion dates.
        Job Cards: ${JSON.stringify(jobCards)}
        Movements: ${JSON.stringify(movements)}`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          systemInstruction: "You are an operations expert analyzing manufacturing production flows. Review the job card metadata, required quantities, pending balances, and historical material movements to estimate highly structured completion dates for each job card.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                jobCardNo: {
                  type: Type.STRING,
                  description: "The unique job card number identifier.",
                },
                estimatedCompletionDate: {
                  type: Type.STRING,
                  description: "Estimated date or duration of completion (e.g. '2026-06-25' or 'In Progress' or '2 days').",
                },
                reasoning: {
                  type: Type.STRING,
                  description: "Brief reasoning/analysis for this duration/estimate.",
                }
              },
              required: ["jobCardNo", "estimatedCompletionDate"]
            }
          }
        }
      });

      const text = response.text;
      if (!text) {
        throw new Error("Empty response received from Gemini API");
      }
      
      res.json(JSON.parse(text));
    } catch (error) {
      console.error("Forecast API error:", error);
      res.status(500).json({ error: "Failed to generate forecast" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
