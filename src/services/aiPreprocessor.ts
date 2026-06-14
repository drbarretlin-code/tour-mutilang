import { MultiModalInput } from '../types/survey';
import { GoogleGenerativeAI } from '@google/generative-ai';

const generateId = () => Math.random().toString(36).substring(2, 9);

/**
 * AI Pre-processing Service
 * Parses messy user inputs (URLs, text descriptions) into structured attraction locations using Gemini.
 */
export async function parseAttractionsWithAI(
  apiKey: string,
  rawInput: string
): Promise<MultiModalInput[]> {
  if (!apiKey || !rawInput.trim()) {
    return [];
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `
You are an intelligent travel assistant. The user has provided some messy text or URLs indicating places they want to visit.
Extract the names of the attractions or restaurants mentioned. If possible, estimate their latitude and longitude coordinates.

User Input:
"${rawInput}"

Output a JSON array of objects with the following keys ONLY:
- name: (string) the cleaned up name of the attraction/restaurant
- lat: (number) approximate latitude
- lng: (number) approximate longitude
- notes: (string) any specific notes or requirements mentioned by the user (e.g. "eat at 3pm", "very popular on IG")

Return ONLY valid JSON. Do not include markdown blocks like \`\`\`json.
    `;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    
    // Clean up potential markdown formatting
    const cleanedText = responseText.replace(/```json/gi, '').replace(/```/gi, '').trim();
    
    const parsedData = JSON.parse(cleanedText);
    
    if (!Array.isArray(parsedData)) {
      throw new Error('AI did not return an array');
    }

    return parsedData.map((item: any) => ({
      id: generateId(),
      type: 'text',
      value: item.name || 'Unknown Location',
      lat: typeof item.lat === 'number' ? item.lat : undefined,
      lng: typeof item.lng === 'number' ? item.lng : undefined,
      notes: item.notes || undefined,
    }));

  } catch (error) {
    console.error('AI Parsing failed:', error);
    throw new Error('AI Parsing failed. Please check your API key and try again.');
  }
}
