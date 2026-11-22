import 'dotenv/config';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import express, { type Request, type Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { z } from 'zod';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const leadInputSchema = z.object({
  id: z.string().min(1),
  leadCode: z.string().min(1),
  customerName: z.string().min(1),
  city: z.string(),
  state: z.string(),
  employmentType: z.string(),
  monthlyIncome: z.number(),
  requiredLoanAmount: z.number(),
  loanType: z.string(),
  leadSource: z.string(),
  status: z.string(),
  priority: z.string(),
  callStats: z.object({
    totalCalls: z.number(),
    connectedCalls: z.number(),
    interestedCalls: z.number(),
    notInterestedCalls: z.number(),
    callbackRequests: z.number(),
    lastCallStatus: z.string().optional(),
    lastCallRemarks: z.string().optional(),
  }),
  followUpStats: z.object({
    totalFollowUps: z.number(),
    completedFollowUps: z.number(),
    pendingFollowUps: z.number(),
    overdueFollowUps: z.number(),
  }),
  docCount: z.number(),
});

const scoreRequestSchema = z.object({
  leads: z.array(leadInputSchema).min(1).max(15),
});

function createAiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in server environment.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function startServer() {
  const app = express();
  const port = Number(process.env.PORT || 3000);

  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true, service: 'finbridge-crm' });
  });

  app.post('/api/ai/score-leads', async (req: Request, res: Response) => {
    const parsed = scoreRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid lead scoring payload.', details: parsed.error.flatten() });
      return;
    }

    try {
      const ai = createAiClient();
      const leadsSummary = parsed.data.leads.map((l) => {
        const annualIncome = Math.max(1, l.monthlyIncome * 12);
        const ltiRatio = Number((l.requiredLoanAmount / annualIncome).toFixed(2));
        return {
          ...l,
          loanToAnnualIncomeRatio: ltiRatio,
        };
      });

      const runGeminiScoring = (modelName: 'gemini-4-hydrogen' | 'gemini-3.1-flash-lite') =>
        ai.models.generateContent({
          model: modelName,
          contents: JSON.stringify({ leads: leadsSummary }),
          config: {
            systemInstruction:
              'You are a senior financial services credit underwriting and loan sales conversion analyst. Score each loan lead from 0 to 100 based on conversion likelihood and underwriting readiness using 4 sub-scores: demographics (0-25: city tier, employment stability), financialCapacity (0-30: monthly income vs loan-to-annual-income ratio and loan type fit), sourceQuality (0-15: Referral/Partner Bank/Organic/Website intent strength), and engagementHistory (0-30: positive call outcomes like Interested/Connected/Callback, completed follow-ups, KYC docs uploaded, minus penalties for Not Interested/Wrong Number/overdue neglect). Classify scoreTier as "Hot" (75-100), "Warm" (45-74), or "Cold" (0-44), recommend priority ("High", "Medium", or "Low"), and write a concise 1-sentence scoreSummary explaining the key drivers.',
            ...(modelName === 'gemini-4-hydrogen'
              ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
              : {}),
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                scores: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: { type: Type.STRING },
                      leadScore: { type: Type.INTEGER },
                      scoreTier: { type: Type.STRING },
                      recommendedPriority: { type: Type.STRING },
                      scoreFactors: {
                        type: Type.OBJECT,
                        properties: {
                          demographics: { type: Type.INTEGER },
                          financialCapacity: { type: Type.INTEGER },
                          sourceQuality: { type: Type.INTEGER },
                          engagementHistory: { type: Type.INTEGER },
                        },
                        required: ['demographics', 'financialCapacity', 'sourceQuality', 'engagementHistory'],
                      },
                      scoreSummary: { type: Type.STRING },
                    },
                    required: ['id', 'leadScore', 'scoreTier', 'recommendedPriority', 'scoreFactors', 'scoreSummary'],
                  },
                },
              },
              required: ['scores'],
            },
          },
        });

      let usedModel: 'gemini-4-hydrogen' | 'gemini-3.1-flash-lite' = 'gemini-4-hydrogen';
      let response;
      try {
        response = await runGeminiScoring('gemini-4-hydrogen');
      } catch (firstErr) {
        const msg = firstErr instanceof Error ? firstErr.message : '';
        if (msg.includes('503') || msg.includes('UNAVAILABLE')) {
          await new Promise((resolve) => setTimeout(resolve, 600));
          usedModel = 'gemini-3.1-flash-lite';
          response = await runGeminiScoring('gemini-3.1-flash-lite');
        } else {
          throw firstErr;
        }
      }

      const rawText = response.text;
      if (!rawText) {
        throw new Error('Gemini returned an empty scoring response.');
      }
      const data = JSON.parse(rawText) as {
        scores: Array<{
          id: string;
          leadScore: number;
          scoreTier: string;
          recommendedPriority: string;
          scoreFactors: {
            demographics: number;
            financialCapacity: number;
            sourceQuality: number;
            engagementHistory: number;
          };
          scoreSummary: string;
        }>;
      };

      const normalized = (data.scores || []).map((item) => {
        const clamped = Math.max(0, Math.min(100, Math.round(item.leadScore)));
        const tier = clamped >= 75 ? 'Hot' : clamped >= 45 ? 'Warm' : 'Cold';
        const recPriority = clamped >= 75 ? 'High' : clamped >= 45 ? 'Medium' : 'Low';
        return {
          id: item.id,
          leadScore: clamped,
          scoreTier: tier,
          recommendedPriority:
            item.recommendedPriority === 'High' || item.recommendedPriority === 'Medium' || item.recommendedPriority === 'Low'
              ? item.recommendedPriority
              : recPriority,
          scoreFactors: {
            demographics: Math.max(0, Math.min(25, Math.round(item.scoreFactors.demographics))),
            financialCapacity: Math.max(0, Math.min(30, Math.round(item.scoreFactors.financialCapacity))),
            sourceQuality: Math.max(0, Math.min(15, Math.round(item.scoreFactors.sourceQuality))),
            engagementHistory: Math.max(0, Math.min(30, Math.round(item.scoreFactors.engagementHistory))),
          },
          scoreSummary: String(item.scoreSummary || '').slice(0, 400),
          scoreModel: usedModel,
        };
      });

      res.json({ results: normalized, model: usedModel });
    } catch (err) {
      console.error('AI Lead Scoring error:', err);
      let message = err instanceof Error ? err.message : 'Failed to score leads with Gemini AI.';
      try {
        const parsedErr = JSON.parse(message) as { error?: { message?: string } };
        if (parsedErr?.error?.message) {
          message = parsedErr.error.message;
        }
      } catch {
        // Keep original message when not JSON-formatted
      }
      res.status(502).json({ error: message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distDir)) {
      app.use(express.static(distDir));
      app.get('*', (_req: Request, res: Response) => {
        res.sendFile(path.join(distDir, 'index.html'));
      });
    }
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`FinBridge CRM server running on http://0.0.0.0:${port}`);
  });
}

void startServer();
