import { generateMathSolution as geminiGenerateMathSolution, generateMathSolutionFromImage as geminiGenerateMathSolutionFromImage } from './gemini-api';

export async function generateMathSolution(input: string) {
  try {
    if (!input.trim()) {
      throw new Error('Please provide a math problem to solve');
    }
    return await geminiGenerateMathSolution(input);
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