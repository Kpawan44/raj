import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import nodemailer from "nodemailer";

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

  // Global log for all triggered emails (in-memory persistent state)
  interface SentEmail {
    id: string;
    timestamp: string;
    subject: string;
    recipient: string;
    executiveSummary: string;
    criticalBottlenecks: string[];
    recommendedActions: string[];
    htmlBody: string;
    status: 'sent' | 'queued' | 'simulated';
    error?: string;
  }

  const sentEmailsLog: SentEmail[] = [
    {
      id: "se-1",
      timestamp: new Date(Date.now() - 3600000 * 24).toISOString(), // 1 day ago
      subject: "[Daily Operations Summary] PMW Factory Yield: 97.4% with 2 Pending Completions",
      recipient: "pawan.kummar16@gmail.com",
      executiveSummary: "Factory operations run within normal limits. Materials dispatch and heat treatment schedules are on track. Minor scrap accumulation of 50 KG observed in JC-1002.",
      criticalBottlenecks: [
        "Moderate scrap loss (10%) detected in Production department for JC-1002."
      ],
      recommendedActions: [
        "Audit tool alignment on trimming machinery to prevent future edge fractures.",
        "Calibrate temperature levels on furnace B ahead of upcoming high-volume alloy run."
      ],
      htmlBody: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2 style="color: #4F46E5; margin-bottom: 20px;">Daily Operations Summary Log</h2>
          <p><strong>Date:</strong> Yesterday</p>
          <p>This is a simulated entry documenting past scheduled runs of the automated reporting cloud function.</p>
        </div>
      `,
      status: "simulated"
    }
  ];

  // GET sent emails outbox
  app.get("/api/sent-emails", (req, res) => {
    res.json(sentEmailsLog);
  });

  // POST trigger automated daily report email
  app.post("/api/trigger-daily-summary", async (req, res) => {
    try {
      const { jobCards = [], movements = [], recipient } = req.body;
      const targetRecipient = recipient || process.env.ADMIN_EMAIL || "pawan.kummar16@gmail.com";
      
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

      // Prepare stats
      const totalJobCards = jobCards.length;
      const pendingJobs = jobCards.filter((c: any) => !c.completed);
      const completedJobs = jobCards.filter((c: any) => c.completed);
      
      const totalOrderQty = jobCards.reduce((acc: number, c: any) => acc + (c.orderQty || 0), 0);
      const totalPendingQty = pendingJobs.reduce((acc: number, c: any) => acc + (c.balanceQty || 0), 0);
      
      // Calculate department rejections
      const deptRejections: Record<string, { processed: number; rejected: number }> = {
        'Production': { processed: 0, rejected: 0 },
        'Heat Treatment': { processed: 0, rejected: 0 },
        'Plating': { processed: 0, rejected: 0 },
        'Packing': { processed: 0, rejected: 0 },
        'Store': { processed: 0, rejected: 0 }
      };

      jobCards.forEach((jc: any) => {
        deptRejections['Production'].processed += jc.orderQty || 0;
        if (jc.status === 'Rejected' && jc.currentDepartment === 'Production') {
          deptRejections['Production'].rejected += jc.orderQty || 0;
        }

        if (jc.heatTreatmentRequired) {
          const htDet = jc.heatTreatmentDetails;
          const htProcessed = htDet?.qtyReceivedFromProd || 0;
          const htRejections = htDet?.rejectionQty || 0;
          deptRejections['Heat Treatment'].processed += htProcessed;
          deptRejections['Heat Treatment'].rejected += htRejections;
        }

        const platDet = jc.platingDetails;
        const platProcessed = platDet?.qtyReceivedFromHt || 0;
        const platRejections = platDet?.rejectionQty || 0;
        deptRejections['Plating'].processed += platProcessed;
        deptRejections['Plating'].rejected += platRejections;

        const packDet = jc.packingDetails;
        const packProcessed = packDet?.qtyReceivedFromPlating || 0;
        const packRejections = packDet?.rejectionQty || 0;
        deptRejections['Packing'].processed += packProcessed;
        deptRejections['Packing'].rejected += packRejections;

        const storeDet = jc.storeDetails;
        const storeProcessed = storeDet?.qtyReceivedFromPacking || 0;
        const storeRejections = storeDet?.rejectionQty || 0;
        deptRejections['Store'].processed += storeProcessed;
        deptRejections['Store'].rejected += storeRejections;
      });

      const processedStats = Object.entries(deptRejections).map(([dept, val]) => {
        const rate = val.processed > 0 ? (val.rejected / val.processed) * 100 : 0;
        return {
          department: dept,
          processedKg: val.processed,
          rejectedKg: val.rejected,
          rejectionRate: `${rate.toFixed(2)}%`
        };
      });

      const activeJobsList = pendingJobs.map((c: any) => ({
        jobCardNo: c.jobCardNo,
        partyName: c.partyName,
        itemName: c.itemName,
        currentQty: c.currentQty,
        balanceQty: c.balanceQty,
        currentDepartment: c.currentDepartment,
        status: c.status,
        createdAt: c.createdAt
      }));

      const systemContext = `
        You are an advanced industrial operations and quality analysis AI daemon at Precision Metal Works.
        Your task is to review the active operations state, pending job cards, and departmental rejection statistics, and generate a comprehensive executive email notification.
        
        DATA FOR ANALYSIS:
        - Total Job Cards: ${totalJobCards}
        - Pending/In-Progress Job Cards: ${pendingJobs.length} (${totalPendingQty} KG remaining)
        - Completed Job Cards: ${completedJobs.length}
        - Department Rejection Metrics: ${JSON.stringify(processedStats)}
        - Active Job Cards: ${JSON.stringify(activeJobsList)}
      `;

      const promptText = `Generate a daily executive summary report for the admin team.
        Review all pending completions and departmental quality rates.
        Ensure your "htmlBody" is a stunningly designed responsive HTML template with inline styles, custom typography, slate-900 styled table rows, highlighted alert boxes for high rejection rates (e.g. over 5%), and visual sections for corrective recommendations. Make it look like a high-end email notification sent from a premium enterprise platform. Do not include external assets or image placeholders, only use clean HTML/CSS with standard colors (indigo \`#4F46E5\`, slate \`#1E293B\`, emerald \`#10B981\`, rose \`#EF4444\`).`;

      const geminiResponse = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: promptText,
        config: {
          systemInstruction: systemContext,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              subject: {
                type: Type.STRING,
                description: "The professional, concise subject line of the daily automated operations mail."
              },
              executiveSummary: {
                type: Type.STRING,
                description: "High-level summary of factory yield, completions, and operations for the admin dashboard (2-3 sentences)."
              },
              criticalBottlenecks: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Array of detected process anomalies, high-rejection departments, or overdue job cards."
              },
              recommendedActions: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Strategic action steps the management team should execute to resolve bottlenecks."
              },
              htmlBody: {
                type: Type.STRING,
                description: "Complete, responsive, production-ready, beautifully designed inline-styled HTML email body."
              }
            },
            required: ["subject", "executiveSummary", "criticalBottlenecks", "recommendedActions", "htmlBody"]
          }
        }
      });

      const textOutput = geminiResponse.text;
      if (!textOutput) {
        throw new Error("Failed to receive structured report content from Gemini");
      }

      const reportData = JSON.parse(textOutput);

      // Attempt to transmit email via Nodemailer if SMTP secrets are defined
      let mailStatus: 'sent' | 'queued' | 'simulated' = 'queued';
      let mailError: string | undefined = undefined;

      if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
        try {
          const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT) || 587,
            secure: Number(process.env.SMTP_PORT) === 465,
            auth: {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASS,
            },
          });

          await transporter.sendMail({
            from: `"PMW Automated Operations" <${process.env.SMTP_USER}>`,
            to: targetRecipient,
            subject: reportData.subject,
            html: reportData.htmlBody,
          });

          mailStatus = 'sent';
          console.log(`Daily operations report sent successfully to ${targetRecipient}`);
        } catch (err: any) {
          mailStatus = 'queued';
          mailError = err instanceof Error ? err.message : String(err);
          console.warn("SMTP send failed, email logged to system outbox queue:", mailError);
        }
      } else {
        mailStatus = 'queued';
        console.info(`SMTP credentials not defined. Report successfully compiled and queued in simulated Outbox. Recipient: ${targetRecipient}`);
      }

      const newEmailRecord: SentEmail = {
        id: `se-${Date.now()}`,
        timestamp: new Date().toISOString(),
        subject: reportData.subject,
        recipient: targetRecipient,
        executiveSummary: reportData.executiveSummary,
        criticalBottlenecks: reportData.criticalBottlenecks,
        recommendedActions: reportData.recommendedActions,
        htmlBody: reportData.htmlBody,
        status: mailStatus,
        error: mailError
      };

      sentEmailsLog.unshift(newEmailRecord);

      res.json({
        success: true,
        record: newEmailRecord,
        smtpConfigured: !!process.env.SMTP_HOST
      });

    } catch (error: any) {
      console.error("Daily summary compile error:", error);
      res.status(500).json({ error: "Failed to compile automated daily summary", details: error.message });
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
