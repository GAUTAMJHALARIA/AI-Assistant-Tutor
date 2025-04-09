import { GoogleGenerativeAI } from '@google/generative-ai';

const GEMINI_API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  throw new Error('Missing Gemini API key - please set NEXT_PUBLIC_GEMINI_API_KEY in your environment variables');
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const chatModel = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

interface ChatHistory {
  role: 'user' | 'assistant';
  content: string;
  metadata?: {
    mathTopic?: string;      // e.g., 'derivatives', 'integrals', 'trigonometry'
    problemType?: string;    // e.g., 'find derivative', 'solve equation'
    formula?: string;        // The formula being discussed
    solution?: string;       // Step-by-step solution if provided
    relatedFormulas?: string[];  // Related formulas in the same domain
    conceptLinks?: string[];     // Related mathematical concepts
    previousContext?: string;    // Reference to previous problem or concept
  };
}


export async function handleMathFollowup(
  followupQuestion: string,
  chatHistory: ChatHistory[] = []
): Promise<string> {
  // Check if this is an initial request for context
  if (chatHistory.length === 0 && followupQuestion.toLowerCase().includes('previous context')) {
    return `Topic: Mathematical Context Request
Problem Type: Initial Interaction

I notice this is our first interaction, so there isn't any previous mathematical context to reference. To help you better, please:

1. Tell me which mathematical topic you'd like to explore (e.g., calculus, algebra, geometry, trigonometry)
2. Specify what type of formulas you're interested in (e.g., derivatives, integrals, quadratic equations)
3. Share any specific problem or concept you'd like to understand better

This will help me provide relevant formulas and explanations tailored to your interests.`;
  }

  // Extract the most recent context with enhanced metadata
  const recentContext = chatHistory.slice(-3).map(msg => {
    const metadata = msg.metadata || {};
    const relatedFormulas = metadata.relatedFormulas ? 
      `Related Formulas:\n${metadata.relatedFormulas.map(f => `- ${f}`).join('\n')}` : '';
    const conceptLinks = metadata.conceptLinks ? 
      `Related Concepts:\n${metadata.conceptLinks.map(c => `- ${c}`).join('\n')}` : '';
    
    return `${msg.role}: ${msg.content}\n` +
           `Topic: ${metadata.mathTopic || 'N/A'}\n` +
           `Problem Type: ${metadata.problemType || 'N/A'}\n` +
           `Formula: ${metadata.formula || 'N/A'}\n` +
           `Solution: ${metadata.solution || 'N/A'}\n` +
           `${relatedFormulas}\n` +
           `${conceptLinks}\n` +
           `Previous Context: ${metadata.previousContext || 'N/A'}`;
  }).join('\n\n');
  try {
    const prompt = `You are a helpful math tutor assistant specializing in mathematics education. You help students understand mathematical concepts, solve problems, and explore related formulas and concepts.

When responding, please structure your answers to include:
1. Topic identification (e.g., calculus, algebra, geometry)
2. Problem type classification
3. Relevant formulas being discussed
4. Step-by-step solutions when applicable

Previous Context:
${recentContext}

Current Question:
${followupQuestion}

Instructions:
1. ALWAYS reference and build upon the previous context when answering follow-up questions:
   - Refer to previously discussed formulas and concepts explicitly
   - Connect new concepts to previously explained ones
   - Use the same notation and terminology for consistency

2. For each mathematical concept discussed:
   - List 2-3 related formulas in the same domain
   - Identify 2-3 connected mathematical concepts
   - Reference how it builds on previous topics (if applicable)

3. For each formula shared:
   - Write the formula clearly using LaTeX notation (e.g., $f(x) = x^2$)
   - Explain when and how to use it
   - Provide a simple example if possible
   - List related formulas in the same domain

4. Keep explanations clear and student-friendly:
   - Build on previously explained concepts
   - Use consistent terminology
   - Provide concrete examples

5. Always structure your response with these sections:
   Topic: [mathematical topic]
   Problem Type: [specific type of problem]
   Formula: [if applicable, write formula in LaTeX notation]
   Solution: [step-by-step solution if applicable]
   Related Formulas: [list 2-3 related formulas]
   Related Concepts: [list 2-3 connected concepts]
   Previous Context: [reference to previous problem/concept]

6. For follow-up questions:
   - Explicitly reference previous explanations
   - Use the same notation and terminology
   - Show how new concepts connect to previous ones
   - Build on previously established understanding

Please provide a detailed response that helps the student understand the mathematical concepts better.

Format your response with clear section markers:
Topic: [mathematical topic]
Problem Type: [specific type of problem]
Formula: [if applicable, write formula in LaTeX notation between $ symbols]
Solution: [step-by-step solution if applicable]

Followed by your detailed explanation.`;

    const result = await chatModel.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    return text;
  } catch (error) {
    console.error('Error handling math follow-up:', error);
    throw error instanceof Error
      ? error
      : new Error('Failed to process follow-up question');
  }
}

// Add extractMetadata helper function
export function extractMetadata(text: string, startMarker: string, endMarker: string): string {
  const startIndex = text.indexOf(startMarker);
  if (startIndex === -1) return '';
  
  const contentStart = startIndex + startMarker.length;
  const endIndex = text.indexOf(endMarker, contentStart);
  
  if (endIndex === -1) return '';
  
  return text.substring(contentStart, endIndex).trim();
}