import OpenAI from 'openai';

const GROQ_API_KEY = "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";

if (!GROQ_API_KEY) {
  throw new Error('Missing GROQ API key - please set NEXT_PUBLIC_GROQ_API_KEY in your environment variables');
}

const groqApi = new OpenAI({
  apiKey: GROQ_API_KEY,
  baseURL: 'https://api.groq.com/openai/v1',
  dangerouslyAllowBrowser: true  // Enable browser usage with appropriate security measures
});

export async function generateMathSolution(input: string) {
  try {
    if (!input.trim()) {
      throw new Error('Please provide a math problem to solve');
    }

    const prompt = `Please solve this math problem and provide detailed steps. Format the response as a JSON with this structure:
{
  "steps": "numbered steps showing the solution process",
  "explanation": "detailed explanation of the approach and concepts"
}

Problem: ${input}`;

    const completion = await groqApi.chat.completions.create({
      model: 'mixtral-8x7b-32768',
      messages: [
        { role: 'system', content: 'You are a helpful math tutor that provides detailed step-by-step solutions.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 2048
    });

    const result = completion.choices[0]?.message?.content;
    if (!result) {
      throw new Error('No response received from GROQ API');
    }
    
    try {
      return JSON.parse(result);
    } catch {
      throw new Error('Failed to parse GROQ API response as JSON');
    }
  } catch (error) {
    console.error('Error generating math solution:', error);
    throw error instanceof Error ? error : new Error('An unexpected error occurred');
  }
}

export async function generateMathSolutionFromImage() {
  throw new Error('Image processing requires OCR integration which is not yet implemented');
}