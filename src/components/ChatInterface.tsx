'use client';

import { useState } from 'react';
import { handleMathFollowup, extractMetadata } from '@/lib/chat-api';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

interface ChatHistory {
  role: 'user' | 'assistant';
  content: string;
  metadata?: {
    mathTopic?: string;      // e.g., 'derivatives', 'integrals', 'trigonometry'
    problemType?: string;    // e.g., 'find derivative', 'solve equation'
    formula?: string;        // The formula being discussed
    solution?: string;       // Step-by-step solution if provided
  };
}

interface ChatInterfaceProps {
  initialHistory?: ChatHistory[];
}

export default function ChatInterface({ initialHistory = [] }: ChatInterfaceProps) {
  const [chatHistory, setChatHistory] = useState<ChatHistory[]>(initialHistory);
  const [followupQuestion, setFollowupQuestion] = useState('');
  const [loading, setLoading] = useState(false);

  const handleFollowup = async () => {
    if (!followupQuestion.trim()) return;

    try {
      setLoading(true);
      const userQuestion = followupQuestion;
      setFollowupQuestion('');

      // Add user's question to chat history
      setChatHistory(prev => [...prev, { role: 'user', content: userQuestion }]);

      // Get AI response
      const response = await handleMathFollowup(userQuestion, chatHistory);

      // Initialize default metadata from previous chat if available
      const lastMessage = chatHistory[chatHistory.length - 1];
      const defaultMetadata = lastMessage?.metadata || {};

      // Parse the response to extract metadata, preserving LaTeX formulas
      const metadata = {
        mathTopic: extractMetadata(response, 'Topic:', '\n') || defaultMetadata.mathTopic,
        problemType: extractMetadata(response, 'Problem Type:', '\n') || defaultMetadata.problemType,
        formula: extractMetadata(response, '$', '$') || extractMetadata(response, 'Formula:', '\n') || defaultMetadata.formula,
        solution: extractMetadata(response, 'Solution:', '\n') || defaultMetadata.solution,
        relatedFormulas: extractMetadata(response, 'Related Formulas:', '\n')
          .split('\n')
          .map(f => f.trim())
          .filter(f => f.startsWith('-'))
          .map(f => f.substring(1).trim()),
        conceptLinks: extractMetadata(response, 'Related Concepts:', '\n')
          .split('\n')
          .map(c => c.trim())
          .filter(c => c.startsWith('-'))
          .map(c => c.substring(1).trim()),
        previousContext: extractMetadata(response, 'Previous Context:', '\n')
      };

      // Add AI's response to chat history with metadata
      setChatHistory(prev => [...prev, { 
        role: 'assistant', 
        content: response,
        metadata
      }]);
    } catch (error) {
      console.error('Error handling followup:', error);
      setChatHistory(prev => [...prev, { 
        role: 'assistant', 
        content: error instanceof Error 
          ? `An error occurred: ${error.message}` 
          : 'I apologize, but I encountered an error processing your question. Please try again.'
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-8 bg-white rounded-xl shadow-sm p-6">
      <h2 className="text-2xl font-semibold text-gray-900 mb-4">Math Tutor Chat</h2>
      <p className="text-gray-600 mb-4">Ask questions about mathematical concepts, formulas, or problems. I will help you understand them better.</p>
      
      <div className="space-y-4 mb-6 max-h-[400px] overflow-y-auto">
        {chatHistory.map((message, index) => (
          <div
            key={index}
            className={`p-4 rounded-lg ${
              message.role === 'user'
                ? 'bg-indigo-50 ml-8'
                : 'bg-gray-50 mr-8'
            }`}
          >
            <div className="text-sm text-gray-500 mb-1">
              {message.role === 'user' ? 'You' : 'Math Tutor'}
            </div>
            <div className="prose prose-indigo max-w-none text-gray-900">
              {message.metadata && (
                <div className="text-sm text-indigo-600 mb-2">
                  {message.metadata.mathTopic && (
                    <span className="mr-3">Topic: {message.metadata.mathTopic}</span>
                  )}
                  {message.metadata.problemType && (
                    <span className="mr-3">Problem: {message.metadata.problemType}</span>
                  )}
                </div>
              )}
              <ReactMarkdown
                remarkPlugins={[remarkMath]}
                rehypePlugins={[rehypeKatex]}
                components={{
                  p: ({ children }) => <p className="mb-2 leading-relaxed">{children}</p>,
                  code: ({ children }) => <code className="bg-gray-100 px-1 py-0.5 rounded">{children}</code>
                }}
              >
                {message.content}
              </ReactMarkdown>
              {message.metadata?.formula && (
                <div className="mt-2 p-2 bg-gray-50 rounded-lg">
                  <div className="text-sm font-medium text-gray-500 mb-1">Formula:</div>
                  <ReactMarkdown
                    remarkPlugins={[remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                  >
                    {message.metadata.formula}
                  </ReactMarkdown>
                </div>
              )}
              {message.metadata?.solution && (
                <div className="mt-2 p-2 bg-gray-50 rounded-lg">
                  <div className="text-sm font-medium text-gray-500 mb-1">Solution Steps:</div>
                  <ReactMarkdown
                    remarkPlugins={[remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                  >
                    {message.metadata.solution}
                  </ReactMarkdown>
                </div>
              )}
              
            </div>
          </div>
        ))}
      </div>

      <div className="flex space-x-3">
        <input
          type="text"
          value={followupQuestion}
          onChange={(e) => setFollowupQuestion(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleFollowup()}
          placeholder="Ask a follow-up question..."
          className="flex-1 p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 placeholder-gray-500"
          disabled={loading}
        />
        <button
          onClick={handleFollowup}
          disabled={loading || !followupQuestion.trim()}
          className={`px-6 py-3 rounded-lg font-medium text-white ${
            loading || !followupQuestion.trim()
              ? 'bg-indigo-400 cursor-not-allowed'
              : 'bg-indigo-600 hover:bg-indigo-700'
          }`}
        >
          {loading ? 'Sending...' : 'Send'}
        </button>
      </div>
    </div>
  );
}