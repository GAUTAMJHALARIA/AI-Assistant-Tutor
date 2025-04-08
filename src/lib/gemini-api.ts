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

    const prompt = `You are an expert educational content summarizer. Create a comprehensive summary of the following lecture content.

Guidelines:
1. Start with a brief overview of the main topic
2. Break down the content into logical sections
3. For each section:
   - Identify key concepts and their relationships
   - Highlight important definitions and terms
   - Include relevant examples or applications
   - Note any formulas, equations, or important data
4. End with a conclusion that ties everything together
5. Use bullet points (•) for main points and dashes (-) for sub-points
6. Keep the language clear and academic
7. Maintain a logical flow between sections

Format your response as follows:
[Section Title]
• Main point 1
  - Supporting detail
  - Example or explanation
• Main point 2
  - Supporting detail
  - Example or explanation

Content to summarize:
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

const fixJsonFormatting = (text: string): string => {
  // First, try to find the JSON array
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error('No JSON array found in response');
  }
  
  let jsonText = jsonMatch[0];
  
  // Fix common JSON formatting issues
  jsonText = jsonText
    // Fix unquoted property names
    .replace(/([{,])\s*([a-zA-Z0-9_]+)\s*:/g, '$1"$2":')
    // Fix unquoted string values
    .replace(/:([^"][^,}]*[^"][,}])/g, (match) => {
      const parts = match.split(':');
      const value = parts[1].trim();
      // Don't quote numbers or boolean values
      if (/^\d+$/.test(value) || value === 'true' || value === 'false') {
        return match;
      }
      // Quote single letters (for correct_answer)
      if (/^[A-Z]$/.test(value)) {
        return `:"${value}"${value.endsWith(',') ? ',' : ''}`;
      }
      return match;
    })
    // Remove trailing commas
    .replace(/,(\s*[}\]])/g, '$1')
    // Fix missing commas between objects
    .replace(/}\s*{/g, '},{')
    // Fix missing commas between array elements
    .replace(/]\s*\[/g, '],[')
    // Remove any whitespace between property name and colon
    .replace(/"\s*:/g, '":')
    // Remove any whitespace between colon and value
    .replace(/:\s*"/g, ':"')
    // Fix any remaining unquoted strings in options array
    .replace(/"options":\s*\[([^\]]*)\]/g, (match, options) => {
      const fixedOptions = options.split(',').map((opt: string) => {
        const trimmed = opt.trim();
        if (!trimmed.startsWith('"') && !trimmed.endsWith('"')) {
          return `"${trimmed}"`;
        }
        return trimmed;
      }).join(',');
      return `"options":[${fixedOptions}]`;
    });

  return jsonText;
};

export const generateLectureQuiz = async (text: string): Promise<string> => {
  try {
    const genAI = getGeminiClient();
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

    const prompt = `You are an expert educational quiz creator. Generate a comprehensive quiz based on the following lecture content.

Guidelines:
1. Create 5 multiple choice questions that test different aspects of the content
2. Questions should cover:
   - Key concepts and definitions
   - Important relationships and connections
   - Practical applications
   - Problem-solving scenarios
3. For each question:
   - Make the question clear and unambiguous
   - Provide 4 plausible options (A, B, C, D)
   - Ensure only one correct answer
   - Include a detailed explanation of why the answer is correct
4. Questions should progress from basic to more complex
5. Avoid trivial or overly obvious questions
6. Ensure questions test understanding, not just memorization

CRITICAL: Your response must be a valid JSON array containing exactly 5 question objects. Follow these rules:
- Do not include any markdown formatting
- Do not include any text before or after the JSON array
- Do not include any comments or explanations
- Use double quotes for all strings
- Ensure all JSON syntax is correct
- The array must contain exactly 5 questions
- Each question must have exactly 4 options
- The correct_answer must be one of: "A", "B", "C", or "D"
- Each question object must be properly separated by commas
- All property names must be in double quotes
- All string values must be in double quotes
- No trailing commas allowed

Format your response as a JSON array of objects with this structure:
[
  {
    "question": "Clear, well-formulated question",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correct_answer": "A",
    "explanation": "Detailed explanation of why this is the correct answer, including relevant concepts and reasoning"
  }
]

Content for quiz generation:
${text}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const quizText = response.text();
    
    console.log('Raw quiz response:', quizText);
    
    try {
      // First attempt to clean and fix the JSON
      const cleanQuizText = fixJsonFormatting(quizText);
      console.log('Cleaned quiz text:', cleanQuizText);
      
      // Parse and validate the JSON
      const parsedQuiz = JSON.parse(cleanQuizText);
      
      // Validate the structure
      if (!Array.isArray(parsedQuiz)) {
        throw new Error('Response is not an array');
      }
      
      if (parsedQuiz.length !== 5) {
        throw new Error(`Expected 5 questions, got ${parsedQuiz.length}`);
      }
      
      // Validate each question
      parsedQuiz.forEach((q, index) => {
        if (!q.question || typeof q.question !== 'string') {
          throw new Error(`Question ${index + 1} is missing or invalid question text`);
        }
        if (!Array.isArray(q.options) || q.options.length !== 4) {
          throw new Error(`Question ${index + 1} must have exactly 4 options`);
        }
        if (!q.correct_answer || !['A', 'B', 'C', 'D'].includes(q.correct_answer)) {
          throw new Error(`Question ${index + 1} has an invalid correct answer`);
        }
        if (!q.explanation || typeof q.explanation !== 'string') {
          throw new Error(`Question ${index + 1} is missing or invalid explanation`);
        }
      });
      
      return cleanQuizText;
    } catch (parseError) {
      console.error('Failed to parse quiz JSON:', parseError);
      console.error('Raw response:', quizText);
      const errorMessage = parseError instanceof Error ? parseError.message : 'Unknown parsing error';
      throw new Error(`Failed to generate valid quiz format: ${errorMessage}`);
    }
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

    const prompt = `You are an expert educational note-taker. Create comprehensive study notes from the following lecture content.

Guidelines:
1. Organize content into clear, hierarchical sections
2. For each section:
   - Start with a clear heading
   - List key concepts and definitions
   - Include important formulas or equations
   - Provide relevant examples and applications
   - Note any important relationships or connections
3. Use consistent formatting:
   - Main points start with bullet points (•)
   - Sub-points use dashes (-)
   - Important terms in bold
   - Formulas in a separate line
4. Include:
   - Key definitions and terminology
   - Important concepts and their relationships
   - Practical examples and applications
   - Problem-solving approaches
   - Common misconceptions to avoid
5. Maintain academic tone while keeping language clear
6. Ensure logical flow between sections

Format your response as follows:
[Section Title]
• Main concept 1
  - Definition
  - Key characteristics
  - Example
• Main concept 2
  - Definition
  - Key characteristics
  - Example

Content for note generation:
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