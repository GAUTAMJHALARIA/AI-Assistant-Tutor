import { GoogleGenerativeAI } from '@google/generative-ai';

const GEMINI_API_KEY = "AIzaSyCpBixDk37d92bP_gQxL2p1akhbiEX5nWA";

if (!GEMINI_API_KEY) {
  throw new Error('Missing Gemini API key - please set NEXT_PUBLIC_GEMINI_API_KEY in your environment variables');
}

export const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// Using Gemini Flash 1.5 model for improved performance
export const geminiModel = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
export const geminiVisionModel = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

export async function generateMathSolution(input: string) {
  try {
    const prompt = `Please solve this math problem and provide detailed steps. Format the response as a JSON with this structure:
{
  "steps": "numbered steps showing the solution process",
  "explanation": "detailed explanation of the approach and concepts"
}

Problem: ${input}`;

    const result = await geminiModel.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    try {
      return JSON.parse(text);
    } catch {
      return {
        steps: text,
        explanation: 'The response could not be parsed as JSON. Showing raw output.'
      };
    }
  } catch {
    throw new Error('Failed to generate math solution');
  }
}

export async function generateMathSolutionFromImage(imageData: string) {
  try {
    const prompt = "Please solve this math problem from the image and provide detailed steps. Format the response as a JSON with this structure:\n{\n  \"steps\": \"numbered steps showing the solution process\",\n  \"explanation\": \"detailed explanation of the approach and concepts\"\n}";

    const result = await geminiVisionModel.generateContent([
      prompt,
      {
        inlineData: {
          data: imageData.replace(/^data:image\/(png|jpeg|jpg);base64,/, ''),
          mimeType: 'image/jpeg'
        }
      }
    ]);

    const response = await result.response;
    const text = response.text();
    try {
      return JSON.parse(text);
    } catch {
      return {
        steps: text,
        explanation: 'The response could not be parsed as JSON. Showing raw output.'
      };
    }
  } catch {
    throw new Error('Failed to generate math solution from image');
  }
}