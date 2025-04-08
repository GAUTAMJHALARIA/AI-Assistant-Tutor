import { GoogleGenerativeAI } from '@google/generative-ai';

// Get API key from environment variable
const GEMINI_API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  throw new Error('Missing Gemini API key - please set NEXT_PUBLIC_GEMINI_API_KEY in your environment variables');
}

export const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// Using different models for text and image processing
export const geminiModel = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
export const geminiVisionModel = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });

export async function generateMathSolution(input: string) {
  try {
    const prompt = `Please solve this math problem and provide a detailed solution. If the problem involves geometry:
1. First identify the shape(s) and their properties
2. List all given measurements and angles
3. Show step-by-step calculations
4. Explain your approach clearly

Your response should be in this format:

SOLUTION STEPS:
[Provide numbered steps with clear calculations]

DETAILED EXPLANATION:
[Provide a thorough explanation of the concepts and approach used]

Problem: ${input}`;

    const result = await geminiModel.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // Split the response into steps and explanation
    const parts = text.split('DETAILED EXPLANATION:');
    const steps = parts[0].replace('SOLUTION STEPS:', '').trim();
    const explanation = parts.length > 1 ? parts[1].trim() : text;

    return {
      steps,
      explanation
    };
  } catch {
    throw new Error('Failed to generate math solution');
  }
}

export async function generateMathSolutionFromImage(imageData: string) {
  try {
    const prompt = `You are looking at a geometric math problem. Please provide a detailed solution following these steps:

1. First identify the shape(s) and their properties
2. List all given measurements and angles
3. Show step-by-step calculations with clear mathematical reasoning
4. Explain your approach thoroughly

Your response should be in this format:

SOLUTION STEPS:
[Provide numbered steps with clear calculations]

DETAILED EXPLANATION:
[Provide a thorough explanation of the concepts and approach used]`;

    // Remove data URL prefix if present
    const base64Image = imageData.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');
    
    const result = await geminiVisionModel.generateContent([
      prompt,
      {
        inlineData: {
          data: base64Image,
          mimeType: 'image/jpeg'
        }
      }
    ]);

    const response = await result.response;
    const text = response.text();
    
    // Split the response into steps and explanation
    const parts = text.split('DETAILED EXPLANATION:');
    const steps = parts[0].replace('SOLUTION STEPS:', '').trim();
    const explanation = parts.length > 1 ? parts[1].trim() : text;

    return {
      steps,
      explanation
    };
  } catch (error) {
    console.error('Error in generateMathSolutionFromImage:', error);
    if (error instanceof Error) {
      throw new Error(`Failed to generate math solution from image: ${error.message}`);
    }
    throw new Error('Failed to generate math solution from image');
  }
}

const getGeminiClient = () => {
  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Gemini API key is not configured. Please check your environment variables.');
  }
  return new GoogleGenerativeAI(apiKey);
};

export const generateLectureSummary = async (text: string): Promise<string> => {
  try {
    const genAI = getGeminiClient();
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

    const prompt = `Please provide a comprehensive summary of the following lecture content. Focus on the main concepts, key points, and important relationships:

${text}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error('Error generating lecture summary:', error);
    if (error instanceof Error) {
      throw new Error(`Failed to generate summary: ${error.message}`);
    }
    throw new Error('Failed to generate summary. Please try again.');
  }
};

export const generateLectureQuiz = async (text: string): Promise<string> => {
  try {
    const genAI = getGeminiClient();
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

    const prompt = `Generate a quiz based on the following lecture content. Include 5 multiple choice questions. For each question, provide the correct answer and a brief explanation. Format the response as a JSON array of objects with the following structure: { question: string, options: string[], correct_answer: string, explanation: string }

${text}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error('Error generating lecture quiz:', error);
    if (error instanceof Error) {
      throw new Error(`Failed to generate quiz: ${error.message}`);
    }
    throw new Error('Failed to generate quiz. Please try again.');
  }
};

export const generateLectureNotes = async (text: string): Promise<string> => {
  try {
    const genAI = getGeminiClient();
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

    const prompt = `Please create detailed lecture notes from the following content. Include main concepts, definitions, examples, and key relationships:

${text}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error('Error generating lecture notes:', error);
    if (error instanceof Error) {
      throw new Error(`Failed to generate notes: ${error.message}`);
    }
    throw new Error('Failed to generate notes. Please try again.');
  }
};