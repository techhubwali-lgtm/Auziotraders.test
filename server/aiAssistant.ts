import { GoogleGenAI } from '@google/genai';

export type AdminAiTaskType =
  | 'daily_report'
  | 'sales_followup'
  | 'document_extract'
  | 'business_chat';

export interface AdminAiRequest {
  task: AdminAiTaskType;
  prompt: string;
  contextSummary?: string;
}

export interface AdminAiResponse {
  ok: boolean;
  output?: string;
  model?: string;
  generatedAt: string;
  error?: string;
}

const SYSTEM_PROMPTS: Record<AdminAiTaskType, string> = {
  daily_report:
    'You are the Executive Operations & Finance Analyst for Auzio Traders (Japanese used vehicle exporter based in Yokohama). Using ONLY the live business figures supplied in the prompt, write a concise, board-ready Daily Business Report with sections: Executive Highlights, Financial Health, Order Pipeline & Logistics Bottlenecks, and Top 3 Recommended Actions Today. Never invent numbers not present in the provided data.',
  sales_followup:
    'You are a senior international automotive export sales specialist at Auzio Traders in Yokohama, Japan. Draft a polite, clear, professional customer follow-up message (email + short WhatsApp version) based strictly on the provided lead/quotation details. Do not fabricate prices, vessel dates, or vehicle specifications.',
  document_extract:
    'You are an export documentation specialist for Japanese vehicle exports (Auction Sheets, Bills of Lading, Export Certificates, Commercial Invoices). Extract all key structured fields (Chassis/VIN, Make/Model/Year, Lot Number, Grade, Mileage, Port of Loading, Port of Discharge, Vessel/Voyage, B/L Number, Consignee, Declared Value, Notes/Flags) cleanly in bulleted markdown from the supplied text. Mark missing fields as "Not specified".',
  business_chat:
    'You are the internal Business Assistant for Auzio Traders Admin Console. Answer operational, sales, accounting, HR, and export logistics questions concisely in plain business English, grounded strictly in the live business metrics provided. Never fabricate company figures.',
};

let cachedClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;
  if (!cachedClient) {
    cachedClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return cachedClient;
}

export async function runAdminAiAssistant(input: AdminAiRequest): Promise<AdminAiResponse> {
  const generatedAt = new Date().toISOString();
  const client = getGeminiClient();

  if (!client) {
    return {
      ok: false,
      generatedAt,
      error:
        'AI Assistant is not configured yet. Please ensure GEMINI_API_KEY is available in Settings > Secrets.',
    };
  }

  const task: AdminAiTaskType =
    input.task && input.task in SYSTEM_PROMPTS ? input.task : 'business_chat';
  const promptText = (input.prompt || '').trim().slice(0, 6000);
  const contextText = (input.contextSummary || '').trim().slice(0, 8000);

  if (!promptText) {
    return {
      ok: false,
      generatedAt,
      error: 'Please enter a prompt or document text to analyze.',
    };
  }

  const combinedContents = contextText
    ? `LIVE COMPANY SNAPSHOT (USE ONLY THESE REAL FIGURES):\n${contextText}\n\nUSER REQUEST:\n${promptText}`
    : promptText;

  try {
    const model = 'gemini-4-hydrogen';
    const response = await client.models.generateContent({
      model,
      contents: combinedContents,
      config: {
        systemInstruction: SYSTEM_PROMPTS[task],
      },
    });

    const text = (response.text || '').trim();
    if (!text) {
      return {
        ok: false,
        generatedAt,
        error: 'The AI model returned an empty response. Please try refining your request.',
      };
    }

    return {
      ok: true,
      output: text,
      model,
      generatedAt,
    };
  } catch (err) {
    const rawMsg = err instanceof Error ? err.message : 'Unexpected AI service error.';
    let friendly = rawMsg;
    if (rawMsg.includes('PERMISSION_DENIED') || rawMsg.includes('API_KEY_INVALID') || rawMsg.includes('403')) {
      friendly =
        'AI API key permission error. Please check your API key in Settings > Secrets.';
    } else if (rawMsg.includes('RESOURCE_EXHAUSTED') || rawMsg.includes('429')) {
      friendly = 'AI rate limit reached. Please wait a moment and try again.';
    }
    return {
      ok: false,
      generatedAt,
      error: friendly,
    };
  }
}
