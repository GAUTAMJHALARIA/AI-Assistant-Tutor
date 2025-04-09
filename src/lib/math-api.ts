import { generateMathSolution as geminiGenerateMathSolution, generateMathSolutionFromImage as geminiGenerateMathSolutionFromImage } from './gemini-api';

interface ChatHistory {
  role: 'user' | 'assistant';
  content: string;
}

interface MathSolutionResponse {
  steps: string;
  explanation: string;
  chatHistory?: ChatHistory[];
}

export async function generateMathSolution(input: string): Promise<MathSolutionResponse> {
  try {
    if (!input.trim()) {
      throw new Error('Please provide a math problem to solve');
    }
    const solution = await geminiGenerateMathSolution(input);
    return {
      ...solution,
      chatHistory: [
        { role: 'user', content: input },
        { role: 'assistant', content: `${solution.steps}\n\n${solution.explanation}` }
      ]
    };
  } catch (error) {
    console.error('Error generating math solution:', error);
    throw error instanceof Error ? error : new Error('An unexpected error occurred');
  }
}

export async function generateMathSolutionFromImage(imageData: string) {
  try {
    if (!imageData) {
      throw new Error('Please provide an image to process');
    }
    return await geminiGenerateMathSolutionFromImage(imageData);
  } catch (error) {
    console.error('Error generating math solution from image:', error);
    throw error instanceof Error ? error : new Error('An unexpected error occurred');
  }
}