'use client';

import { useState } from 'react';

type ProcessingStep = 'summary' | 'quiz' | 'notes' | null;
type VideoSource = 'youtube' | 'upload' | null;

type Quiz = {
  question: string;
  options: string[];
  correct_answer: string;
  explanation: string;
};

type Content = {
  summary?: string;
  quiz?: Quiz[];
  notes?: string;
};

export default function LectureSummarizer() {
  const [videoUrl, setVideoUrl] = useState('');
  const [videoSource, setVideoSource] = useState<VideoSource>(null);
  const [processingStep, setProcessingStep] = useState<ProcessingStep>(null);
  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState<Content>({});
  const [selectedQuizAnswers, setSelectedQuizAnswers] = useState<{[key: number]: string}>({});
  const [showQuizResults, setShowQuizResults] = useState(false);

  const handleVideoProcess = async () => {
    setLoading(true);
    // TODO: Implement video processing logic
    setTimeout(() => {
      setLoading(false);
    }, 2000);
  };

  const generateContent = async (type: ProcessingStep) => {
    if (!type) return;
    
    setProcessingStep(type);
    setLoading(true);

    // TODO: Implement API calls for content generation
    setTimeout(() => {
      switch (type) {
        case 'summary':
          setContent(prev => ({
            ...prev,
            summary: 'This is a sample summary of the lecture...'
          }));
          break;
        case 'quiz':
          setContent(prev => ({
            ...prev,
            quiz: [
              {
                question: 'Sample question 1?',
                options: ['A) Option 1', 'B) Option 2', 'C) Option 3', 'D) Option 4'],
                correct_answer: 'A',
                explanation: 'Explanation for the correct answer...'
              }
            ]
          }));
          break;
        case 'notes':
          setContent(prev => ({
            ...prev,
            notes: '# Lecture Notes\n\n## Key Points\n- Point 1\n- Point 2\n\n## Examples\n1. Example 1\n2. Example 2'
          }));
          break;
      }
      setLoading(false);
    }, 2000);
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Lecture Summarizer</h1>
        <p className="text-gray-600">Transform video lectures into comprehensive study materials</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6 mb-8">
        <div className="flex space-x-4 mb-6">
          <button
            onClick={() => setVideoSource('youtube')}
            className={`px-4 py-2 rounded-lg font-medium ${videoSource === 'youtube'
              ? 'bg-indigo-100 text-indigo-700'
              : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
            }`}
          >
            📺 YouTube Link
          </button>
          <button
            onClick={() => setVideoSource('upload')}
            className={`px-4 py-2 rounded-lg font-medium ${videoSource === 'upload'
              ? 'bg-indigo-100 text-indigo-700'
              : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
            }`}
          >
            📤 Upload Video
          </button>
        </div>

        {videoSource === 'youtube' && (
          <div className="mb-6">
            <input
              type="text"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="Enter YouTube URL"
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
        )}

        {videoSource === 'upload' && (
          <div className="mb-6 border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
            <input
              type="file"
              accept="video/*"
              className="hidden"
              id="video-upload"
            />
            <label
              htmlFor="video-upload"
              className="cursor-pointer block text-gray-500"
            >
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                stroke="currentColor"
                fill="none"
                viewBox="0 0 48 48"
              >
                <path
                  d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <p className="mt-1">Click to upload a video file</p>
            </label>
          </div>
        )}

        {videoSource && (
          <div className="flex justify-center">
            <button
              onClick={handleVideoProcess}
              disabled={loading}
              className={`px-6 py-3 rounded-lg font-medium text-white ${loading
                ? 'bg-indigo-400 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-700'
              }`}
            >
              {loading ? 'Processing...' : '🎥 Process Video'}
            </button>
          </div>
        )}
      </div>

      {videoSource && !loading && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex space-x-4 mb-6">
            <button
              onClick={() => generateContent('summary')}
              className={`px-4 py-2 rounded-lg font-medium ${processingStep === 'summary'
                ? 'bg-indigo-100 text-indigo-700'
                : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
              }`}
            >
              📝 Generate Summary
            </button>
            <button
              onClick={() => generateContent('quiz')}
              className={`px-4 py-2 rounded-lg font-medium ${processingStep === 'quiz'
                ? 'bg-indigo-100 text-indigo-700'
                : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
              }`}
            >
              🧠 Generate Quiz
            </button>
            <button
              onClick={() => generateContent('notes')}
              className={`px-4 py-2 rounded-lg font-medium ${processingStep === 'notes'
                ? 'bg-indigo-100 text-indigo-700'
                : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
              }`}
            >
              📓 Generate Notes
            </button>
          </div>

          {loading && (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto"></div>
              <p className="mt-4 text-gray-600">Generating content...</p>
            </div>
          )}

          {!loading && processingStep === 'summary' && content.summary && (
            <div className="prose max-w-none">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Lecture Summary</h2>
              <div className="bg-gray-50 p-6 rounded-lg">
                {content.summary}
              </div>
            </div>
          )}

          {!loading && processingStep === 'quiz' && content.quiz && (
            <div className="prose max-w-none">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Knowledge Check</h2>
              {content.quiz.map((q, index) => (
                <div key={index} className="mb-8 bg-gray-50 p-6 rounded-lg">
                  <h3 className="text-lg font-medium mb-4">Question {index + 1}: {q.question}</h3>
                  <div className="space-y-2">
                    {q.options.map((option, optIndex) => (
                      <label key={optIndex} className="flex items-center space-x-3 p-2 rounded hover:bg-gray-100">
                        <input
                          type="radio"
                          name={`question-${index}`}
                          value={option.charAt(0)}
                          checked={selectedQuizAnswers[index] === option.charAt(0)}
                          onChange={() => {
                            setSelectedQuizAnswers(prev => ({
                              ...prev,
                              [index]: option.charAt(0)
                            }));
                          }}
                          className="h-4 w-4 text-indigo-600"
                        />
                        <span>{option}</span>
                      </label>
                    ))}
                  </div>
                  {showQuizResults && selectedQuizAnswers[index] && (
                    <div className={`mt-4 p-3 rounded ${selectedQuizAnswers[index] === q.correct_answer ? 'bg-green-100' : 'bg-red-100'}`}>
                      <p className="font-medium">
                        {selectedQuizAnswers[index] === q.correct_answer ? '✅ Correct!' : '❌ Incorrect'}
                      </p>
                      <p className="mt-2">{q.explanation}</p>
                    </div>
                  )}
                </div>
              ))}
              <button
                onClick={() => setShowQuizResults(true)}
                className="px-6 py-3 rounded-lg font-medium text-white bg-indigo-600 hover:bg-indigo-700"
              >
                Check Answers
              </button>
            </div>
          )}

          {!loading && processingStep === 'notes' && content.notes && (
            <div className="prose max-w-none">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Study Notes</h2>
              <div className="bg-gray-50 p-6 rounded-lg whitespace-pre-wrap font-mono">
                {content.notes}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}