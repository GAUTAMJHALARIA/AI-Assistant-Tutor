import { GoogleGenerativeAI } from '@google/generative-ai';

const GEMINI_API_KEY = "AIzaSyCpBixDk37d92bP_gQxL2p1akhbiEX5nWA";

if (!GEMINI_API_KEY) {
  throw new Error('Missing Gemini API key - please set NEXT_PUBLIC_GEMINI_API_KEY in your environment variables');
}

export const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// Using different models for text and image processing
export const geminiModel = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
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

export async function generateLectureSummary(text: string) {
  try {
    const prompt = `Analyze this lecture content and create a detailed summary. Structure your response EXACTLY as follows:

QUICK OVERVIEW
• Brief 2-3 sentence overview of the main topic
• Why this topic is important
• What you'll learn from this lecture

MAIN CONCEPTS
• [Concept 1 Name]: Detailed explanation with examples
• [Concept 2 Name]: Detailed explanation with examples
• [Concept 3 Name]: Detailed explanation with examples

KEY RELATIONSHIPS
• How the main concepts connect to each other
• Important cause-and-effect relationships
• Real-world applications or implications

IMPORTANT TERMINOLOGY
• [Term 1]: Clear definition with example usage
• [Term 2]: Clear definition with example usage
• [Term 3]: Clear definition with example usage

CRITICAL INSIGHTS
• Key insight or takeaway 1 with explanation
• Key insight or takeaway 2 with explanation
• Key insight or takeaway 3 with explanation

Note: Replace bracketed text with actual content. Use bullet points (•) consistently. Make each point detailed and informative.`;

    const result = await geminiModel.generateContent(prompt + "\n\nLecture content:\n" + text);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error('Error generating lecture summary:', error);
    throw error instanceof Error ? error : new Error('Failed to generate lecture summary');
  }
}

export async function generateLectureQuiz(text: string) {
  try {
    const prompt = `Based on this lecture content, generate a quiz with 5 multiple-choice questions. Return ONLY a valid JSON array with no additional text, markdown formatting, or code blocks. Each question object must have these exact fields:
{
  "question": "The question text",
  "options": ["Option A", "Option B", "Option C", "Option D"],
  "correct_answer": "A", // Must be A, B, C, or D
  "explanation": "Why this answer is correct"
}

Requirements:
1. Each question tests understanding of key concepts
2. Options are clear and unambiguous
3. Exactly 4 options per question
4. Correct answer is marked as A, B, C, or D
5. Explanation is concise but informative
6. Response must be ONLY the JSON array with no additional text or formatting

Lecture content:
${text}`;

    const result = await geminiModel.generateContent([
      { text: prompt }
    ]);
    
    const response = await result.response;
    let responseText = response.text();
    
    // Clean the response text to remove any markdown or code block syntax
    responseText = responseText
      .replace(/```json\s*/g, '')  // Remove ```json
      .replace(/```\s*$/g, '')     // Remove closing ```
      .replace(/^\s+|\s+$/g, '')   // Trim whitespace
      .replace(/\\n/g, ' ')        // Replace escaped newlines
      .replace(/\n/g, ' ');        // Replace actual newlines
    
    try {
      // Try to parse the cleaned response as JSON
      const parsedQuiz = JSON.parse(responseText);
      
      // Validate the quiz format
      if (!Array.isArray(parsedQuiz)) {
        throw new Error('Quiz response is not an array');
      }
      
      // Validate each question
      parsedQuiz.forEach((q, idx) => {
        if (!q.question || !Array.isArray(q.options) || q.options.length !== 4 || 
            !q.correct_answer || !q.explanation) {
          throw new Error(`Invalid question format at index ${idx}`);
        }
        if (!['A', 'B', 'C', 'D'].includes(q.correct_answer)) {
          throw new Error(`Invalid correct_answer at index ${idx}`);
        }
      });
      
      return parsedQuiz;
    } catch (parseError) {
      console.error('Failed to parse quiz response:', parseError);
      console.error('Raw response:', responseText);
      
      // Try to generate again with a more strict prompt
      const retryPrompt = `${prompt}\n\nIMPORTANT: Return ONLY the JSON array with no additional text, markdown, or formatting. The response must start with [ and end with ]. No code blocks or other text allowed.`;
      
      const retryResult = await geminiModel.generateContent([
        { text: retryPrompt }
      ]);
      
      const retryResponse = await retryResult.response;
      let retryText = retryResponse.text()
        .replace(/```json\s*/g, '')
        .replace(/```\s*$/g, '')
        .replace(/^\s+|\s+$/g, '')
        .replace(/\\n/g, ' ')
        .replace(/\n/g, ' ');
      
      try {
        const retryParsed = JSON.parse(retryText);
        if (Array.isArray(retryParsed) && retryParsed.length > 0) {
          return retryParsed;
        }
      } catch {
        throw new Error('Failed to generate valid quiz format after retry');
      }
      throw new Error('Failed to generate valid quiz format');
    }
  } catch (error) {
    console.error('Error generating lecture quiz:', error);
    throw error instanceof Error ? error : new Error('Failed to generate lecture quiz');
  }
}

export async function generateLectureNotes(text: string) {
  try {
    const prompt = `Create comprehensive study notes from this lecture content. Structure your response EXACTLY as follows:

LECTURE OVERVIEW
• Topic Introduction: Brief overview of the subject matter
• Learning Objectives: What you should understand after this lecture
• Prerequisites: Required background knowledge or concepts
• Real-World Relevance: Why this topic matters in practice

CORE CONCEPTS IN DETAIL
• [Concept 1 Name]
  - Detailed explanation of the concept
  - Key characteristics or components
  - Common misconceptions or challenges
  - Practical examples or applications

• [Concept 2 Name]
  - Detailed explanation of the concept
  - Key characteristics or components
  - Common misconceptions or challenges
  - Practical examples or applications

• [Concept 3 Name]
  - Detailed explanation of the concept
  - Key characteristics or components
  - Common misconceptions or challenges
  - Practical examples or applications

PRACTICAL APPLICATIONS
• [Application 1]: Detailed example with step-by-step explanation
• [Application 2]: Detailed example with step-by-step explanation
• Common Use Cases: Where and how these concepts are applied

IMPORTANT FORMULAS & PRINCIPLES
• [Formula/Principle 1]
  - What it means
  - When to use it
  - Example application
• [Formula/Principle 2]
  - What it means
  - When to use it
  - Example application

CONNECTIONS & RELATIONSHIPS
• How different concepts relate to each other
• Dependencies and prerequisites
• Integration with other topics or fields

// STUDY TIPS & COMMON PITFALLS
// • Key points to remember
// • Common mistakes to avoid
// • Practice suggestions
// • Review strategies

Note: Replace bracketed text with actual content. Use bullet points (•) for main points and hyphens (-) for sub-points. Make explanations clear and detailed.`;

    const result = await geminiModel.generateContent(prompt + "\n\nLecture content:\n" + text);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error('Error generating lecture notes:', error);
    throw error instanceof Error ? error : new Error('Failed to generate lecture notes');
  }
}