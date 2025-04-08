'use client';

import { useState, useRef } from 'react';
import { generateLectureSummary, generateLectureQuiz, generateLectureNotes } from '@/lib/gemini-api';
import { FiX, FiCheck } from 'react-icons/fi';

type ProcessingStep = 'transcribe' | 'summary' | 'quiz' | 'notes' | null;
type VideoSource = 'youtube' | 'upload' | null;

type Quiz = {
  question: string;
  options: string[];
  correct_answer: string;
  explanation: string;
};

type Content = {
  transcription?: string;
  summary?: string;
  quiz?: Quiz[];
  notes?: string;
};

type TranscriptionStage = {
  stage: 'preparing' | 'processing' | 'transcribing' | 'finalizing' | 'complete';
  progress: number;
  estimatedTimeRemaining: number;
  message: string;
};

export default function LectureSummarizer() {
  const [videoUrl, setVideoUrl] = useState('');
  const [videoSource, setVideoSource] = useState<VideoSource>('youtube');
  const [processingStep, setProcessingStep] = useState<ProcessingStep>(null);
  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState<Content>({});
  const [selectedQuizAnswers, setSelectedQuizAnswers] = useState<{[key: number]: string}>({});
  const [showQuizResults, setShowQuizResults] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadedVideo, setUploadedVideo] = useState<File | null>(null);
  const [transcriptionStage, setTranscriptionStage] = useState<TranscriptionStage | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleVideoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadedVideo(file);
      setVideoSource('upload');
    }
  };

  const handleVideoUrlChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setVideoUrl(event.target.value);
  };

  const handleTranscribe = async () => {
    setProcessingStep('transcribe');
    setLoading(true);
    setIsTranscribing(true);
    setTranscriptionStage(null);
    setError(null);

    // Create new AbortController for this transcription
    abortControllerRef.current = new AbortController();

    // Set up a timeout
    const timeoutId = setTimeout(() => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        setError('Transcription timed out. Please try again.');
      }
    }, 300000); // 5 minutes timeout

    try {
      const formData = new FormData();
      
      if (videoSource === 'youtube' && videoUrl) {
        formData.append('videoUrl', videoUrl);
      } else if (videoSource === 'upload' && uploadedVideo) {
        formData.append('videoFile', uploadedVideo);
      } else {
        throw new Error('No video source selected');
      }

      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
        signal: abortControllerRef.current.signal,
        headers: {
          'Accept': 'text/event-stream',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to start transcription: ${response.status} ${response.statusText} - ${errorText}`);
      }

      if (!response.body) {
        throw new Error('No response body received from server');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep the last incomplete line in the buffer

        for (const line of lines) {
          if (line.trim() === '') continue; // Skip empty lines
          
          if (line.startsWith('data: ')) {
            try {
              const jsonStr = line.slice(6).trim();
              if (!jsonStr) continue; // Skip empty data messages
              
              const data = JSON.parse(jsonStr);
              
              if (data.error) {
                throw new Error(data.error);
              }
              
              if (data.stage === 'error') {
                throw new Error(data.message || 'Transcription failed');
              }
              
              if (data.stage) {
                setTranscriptionStage(data);
                
                // If transcription is complete, update the content
                if (data.stage === 'complete' && data.transcript) {
                  setContent(prev => ({
                    ...prev,
                    transcription: data.transcript
                  }));
                  // Automatically generate summary after successful transcription
                  await generateContent('summary');
                }
              }
              
              if (data.transcript) {
                setContent(prev => ({
                  ...prev,
                  transcription: data.transcript
                }));
              }
            } catch (parseError) {
              console.error('Error parsing server message:', parseError, 'Line:', line);
              throw new Error(`Failed to process server response: ${parseError instanceof Error ? parseError.message : 'Unknown parsing error'}`);
            }
          }
        }
      }
    } catch (err) {
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          setError('Transcription cancelled');
        } else if (err.name === 'TypeError' && err.message.includes('fetch')) {
          setError('Network error. Please check your connection and try again.');
        } else {
          setError(err.message || 'Failed to transcribe video. Please try again or paste the lecture text directly.');
        }
      } else {
        setError('An unexpected error occurred');
      }
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
      setIsTranscribing(false);
      abortControllerRef.current = null;
    }
  };

  const handleCancelTranscription = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const generateContent = async (type: ProcessingStep) => {
    if (!type || (!content.transcription)) {
      setError('Please provide some lecture content first');
      return;
    }
    
    setProcessingStep(type);
    setLoading(true);
    setError(null);

    const inputText = content.transcription;

    try {
      switch (type) {
        case 'summary':
          try {
            const summary = await generateLectureSummary(inputText);
            setContent(prev => ({
              ...prev,
              summary
            }));
          } catch (summaryError) {
            console.error('Error generating summary:', summaryError);
            setError('Failed to generate summary. Please check your API key and try again.');
            return;
          }
          break;
        case 'quiz':
          try {
            const quizResponse = await generateLectureQuiz(inputText);
            const formattedQuiz = Array.isArray(quizResponse) ? quizResponse : JSON.parse(quizResponse);
            setContent(prev => ({
              ...prev,
              quiz: formattedQuiz.map((q: Quiz) => ({
                question: q.question,
                options: q.options,
                correct_answer: q.correct_answer,
                explanation: q.explanation
              }))
            }));
          } catch (quizError) {
            console.error('Error generating quiz:', quizError);
            setError('Failed to generate quiz. Please check your API key and try again.');
            return;
          }
          break;
        case 'notes':
          try {
            const notes = await generateLectureNotes(inputText);
            setContent(prev => ({
              ...prev,
              notes
            }));
          } catch (notesError) {
            console.error('Error generating notes:', notesError);
            setError('Failed to generate notes. Please check your API key and try again.');
            return;
          }
          break;
      }
    } catch (err) {
      console.error('Error generating content:', err);
      if (err instanceof Error) {
        if (err.message.includes('API key')) {
          setError('Invalid or missing API key. Please check your environment variables.');
        } else {
          setError(`Failed to generate content: ${err.message}`);
        }
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const renderSection = (section: string) => {
    const lines = section.split('\n');
    const title = lines[0].trim();
    const points = lines.slice(1);

    if (!title || points.length === 0) return null;

    return (
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-50 to-white px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-bold text-gray-900">{title}</h3>
        </div>
        <div className="p-6">
          <div className="space-y-6">
            {points.map((point, idx) => {
              const trimmedPoint = point.trim();
              if (!trimmedPoint) return null;

              // Check if it's a main point (starts with •) or sub-point (starts with -)
              const isMainPoint = trimmedPoint.startsWith('•');
              const isSubPoint = trimmedPoint.startsWith('-');
              
              if (!isMainPoint && !isSubPoint) return null;

              const content = trimmedPoint.replace(/^[•-]\s*/, '');
              const [label, description] = content.split(':').map(s => s.trim());
              
              if (isMainPoint) {
                return (
                  <div key={idx} className="space-y-3">
                    <div className="flex items-start gap-4">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-50 flex items-center justify-center mt-0.5">
                        <span className="text-indigo-600">•</span>
                      </span>
                      <div className="flex-1">
                        {description ? (
                          <>
                            <span className="font-medium text-gray-900">{label}:</span>
                            <span className="text-gray-700 ml-1">{description}</span>
                          </>
                        ) : (
                          <span className="text-gray-700">{label}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              } else {
                return (
                  <div key={idx} className="ml-8 flex items-start gap-3">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-gray-50 flex items-center justify-center mt-0.5">
                      <span className="text-gray-400">-</span>
                    </span>
                    <div className="flex-1">
                      {description ? (
                        <>
                          <span className="font-medium text-gray-700">{label}:</span>
                          <span className="text-gray-600 ml-1">{description}</span>
                        </>
                      ) : (
                        <span className="text-gray-600">{label}</span>
                      )}
                    </div>
                  </div>
                );
              }
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Lecture Summarizer</h1>
        <p className="text-gray-600">Transform lecture videos into comprehensive study materials</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6 mb-8">
        <div className="mb-6">
          <div className="flex space-x-4 mb-4">
            <button
              onClick={() => setVideoSource('youtube')}
              className={`px-4 py-2 rounded-lg font-medium ${
                videoSource === 'youtube'
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
              }`}
            >
              🎥 YouTube URL
            </button>
            <button
              onClick={() => setVideoSource('upload')}
              className={`px-4 py-2 rounded-lg font-medium ${
                videoSource === 'upload'
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
              }`}
            >
              📤 Upload Video
            </button>
          </div>

          {videoSource === 'youtube' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                YouTube Video URL
              </label>
              <input
                type="url"
                value={videoUrl}
                onChange={handleVideoUrlChange}
                placeholder="Paste YouTube video URL here..."
                className="w-full p-4 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              {videoUrl && (
                <button
                  onClick={handleTranscribe}
                  disabled={loading}
                  className="mt-4 px-6 py-3 rounded-lg font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400"
                >
                  Transcribe Video
                </button>
              )}
            </div>
          )}

          {videoSource === 'upload' && (
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              <input
                type="file"
                accept="video/*"
                onChange={handleVideoUpload}
                className="hidden"
                id="video-upload"
              />
              <label
                htmlFor="video-upload"
                className="cursor-pointer block"
              >
                {uploadedVideo ? (
                  <div className="text-gray-700">
                    <p className="font-medium">{uploadedVideo.name}</p>
                    <p className="text-sm text-gray-500 mt-1">
                      {(uploadedVideo.size / (1024 * 1024)).toFixed(2)} MB
                    </p>
                    <button
                      onClick={handleTranscribe}
                      disabled={loading}
                      className="mt-4 px-6 py-3 rounded-lg font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400"
                    >
                      Transcribe Video
                    </button>
                  </div>
                ) : (
                  <div className="text-gray-500">
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
                  </div>
                )}
              </label>
            </div>
          )}
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        {content.transcription && (
          <div className="flex space-x-4">
            <button
              onClick={() => generateContent('summary')}
              disabled={loading}
              className={`px-4 py-2 rounded-lg font-medium ${
                processingStep === 'summary'
                  ? 'bg-indigo-100 text-indigo-700'
                  : loading
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
              }`}
            >
              📝 Generate Summary
            </button>
            <button
              onClick={() => generateContent('quiz')}
              disabled={loading}
              className={`px-4 py-2 rounded-lg font-medium ${
                processingStep === 'quiz'
                  ? 'bg-indigo-100 text-indigo-700'
                  : loading
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
              }`}
            >
              🧠 Generate Quiz
            </button>
            <button
              onClick={() => generateContent('notes')}
              disabled={loading}
              className={`px-4 py-2 rounded-lg font-medium ${
                processingStep === 'notes'
                  ? 'bg-indigo-100 text-indigo-700'
                  : loading
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
              }`}
            >
              📓 Generate Notes
            </button>
          </div>
        )}
      </div>

      {loading && (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">
            {processingStep === 'transcribe' ? 'Processing video...' : 'Generating content...'}
          </p>
        </div>
      )}

      {isTranscribing && transcriptionStage && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Transcribing Video</h3>
              <button
                onClick={handleCancelTranscription}
                className="text-gray-500 hover:text-gray-700"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Progress Bar */}
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div
                  className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${transcriptionStage.progress}%` }}
                ></div>
              </div>

              {/* Stage Information */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">{transcriptionStage.message}</span>
                  <span className="text-gray-500">
                    {transcriptionStage.estimatedTimeRemaining > 0
                      ? `~${Math.ceil(transcriptionStage.estimatedTimeRemaining)}s remaining`
                      : 'Almost done!'}
                  </span>
                </div>

                {/* Stage Indicators */}
                <div className="flex justify-between text-xs text-gray-500">
                  <div className={`flex items-center ${transcriptionStage.stage === 'preparing' ? 'text-indigo-600' : ''}`}>
                    <span className="w-4 h-4 rounded-full bg-indigo-100 flex items-center justify-center mr-1">
                      {transcriptionStage.stage === 'preparing' ? '1' : <FiCheck className="w-3 h-3" />}
                    </span>
                    Preparing
                  </div>
                  <div className={`flex items-center ${transcriptionStage.stage === 'processing' ? 'text-indigo-600' : ''}`}>
                    <span className="w-4 h-4 rounded-full bg-indigo-100 flex items-center justify-center mr-1">
                      {transcriptionStage.stage === 'processing' ? '2' : transcriptionStage.stage === 'preparing' ? '2' : <FiCheck className="w-3 h-3" />}
                    </span>
                    Processing
                  </div>
                  <div className={`flex items-center ${transcriptionStage.stage === 'transcribing' ? 'text-indigo-600' : ''}`}>
                    <span className="w-4 h-4 rounded-full bg-indigo-100 flex items-center justify-center mr-1">
                      {transcriptionStage.stage === 'transcribing' ? '3' : transcriptionStage.stage === 'preparing' || transcriptionStage.stage === 'processing' ? '3' : <FiCheck className="w-3 h-3" />}
                    </span>
                    Transcribing
                  </div>
                  <div className={`flex items-center ${transcriptionStage.stage === 'finalizing' ? 'text-indigo-600' : ''}`}>
                    <span className="w-4 h-4 rounded-full bg-indigo-100 flex items-center justify-center mr-1">
                      {transcriptionStage.stage === 'finalizing' ? '4' : transcriptionStage.stage === 'complete' ? <FiCheck className="w-3 h-3" /> : '4'}
                    </span>
                    Finalizing
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {!loading && (
        <div className="space-y-8">
          {processingStep === 'summary' && content.summary && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">📚</span>
                  <h2 className="text-2xl font-bold text-gray-900">Lecture Summary</h2>
                </div>
                <button
                  onClick={() => generateContent('quiz')}
                  className="px-4 py-2 text-sm rounded-full bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors"
                >
                  Take Quiz →
                </button>
              </div>
              <div className="grid gap-6">
                {content.summary.split('\n\n').map((section, idx) => (
                  <div key={idx}>{renderSection(section)}</div>
                ))}
              </div>
            </div>
          )}

          {processingStep === 'quiz' && content.quiz && (
            <div className="bg-white rounded-xl shadow-lg p-8 transition-all">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">🧠</span>
                  <h2 className="text-2xl font-bold text-gray-900">Knowledge Check</h2>
                </div>
                <div className="flex items-center space-x-2 text-sm text-gray-500">
                  <span>Progress:</span>
                  <span className="font-medium text-indigo-600">
                    {Object.keys(selectedQuizAnswers).length}/{content.quiz.length}
                  </span>
                </div>
              </div>
              <div className="space-y-10">
                {content.quiz.map((q, index) => (
                  <div key={index} className={`transition-all duration-200 ${
                    showQuizResults ? 'opacity-50' : ''
                  }`}>
                    <div className="flex items-start space-x-4 mb-6">
                      <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-indigo-100 text-indigo-700 rounded-full font-bold">
                        {index + 1}
                      </span>
                      <h3 className="text-lg font-medium text-gray-900">{q.question}</h3>
                    </div>
                    <div className="ml-12 space-y-3">
                      {q.options.map((option, optIndex) => {
                        const letter = String.fromCharCode(65 + optIndex);
                        const isSelected = selectedQuizAnswers[index] === letter;
                        const isCorrect = q.correct_answer === letter;
                        
                        return (
                          <label
                            key={optIndex}
                            className={`flex items-center p-4 rounded-xl border-2 transition-all cursor-pointer ${
                              showQuizResults
                                ? isCorrect
                                  ? 'border-green-200 bg-green-50'
                                  : isSelected
                                  ? 'border-red-200 bg-red-50'
                                  : 'border-gray-100'
                                : isSelected
                                ? 'border-indigo-200 bg-indigo-50'
                                : 'border-gray-100 hover:border-indigo-100 hover:bg-gray-50'
                            }`}
                          >
                            <div className="flex items-center flex-1">
                              <span className={`w-8 h-8 flex items-center justify-center rounded-full mr-4 text-sm font-medium ${
                                showQuizResults
                                  ? isCorrect
                                    ? 'bg-green-100 text-green-700'
                                    : isSelected
                                    ? 'bg-red-100 text-red-700'
                                    : 'bg-gray-100 text-gray-500'
                                  : isSelected
                                  ? 'bg-indigo-100 text-indigo-700'
                                  : 'bg-gray-100 text-gray-500'
                              }`}>
                                {letter}
                              </span>
                              <span className={`flex-1 ${
                                showQuizResults
                                  ? isCorrect
                                    ? 'text-green-700'
                                    : isSelected
                                    ? 'text-red-700'
                                    : 'text-gray-500'
                                  : 'text-gray-700'
                              }`}>
                                {option}
                              </span>
                            </div>
                            <input
                              type="radio"
                              name={`question-${index}`}
                              value={letter}
                              checked={isSelected}
                              onChange={() => {
                                if (!showQuizResults) {
                                  setSelectedQuizAnswers(prev => ({
                                    ...prev,
                                    [index]: letter
                                  }));
                                }
                              }}
                              className="sr-only"
                            />
                            {showQuizResults && (
                              <span className="ml-4 text-lg">
                                {isCorrect && '✅'}
                                {isSelected && !isCorrect && '❌'}
                              </span>
                            )}
                          </label>
                        );
                      })}
                    </div>
                    {showQuizResults && (
                      <div className="ml-12 mt-4">
                        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
                          <p className="font-medium text-indigo-900 mb-2">Explanation</p>
                          <p className="text-indigo-700">{q.explanation}</p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                <div className="flex justify-center mt-8">
                  {!showQuizResults && Object.keys(selectedQuizAnswers).length > 0 && (
                    <button
                      onClick={() => setShowQuizResults(true)}
                      className="px-8 py-4 rounded-xl font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all"
                    >
                      Check Answers
                    </button>
                  )}
                  {showQuizResults && (
                    <button
                      onClick={() => {
                        setShowQuizResults(false);
                        setSelectedQuizAnswers({});
                      }}
                      className="px-8 py-4 rounded-xl font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors"
                    >
                      Try Again
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {processingStep === 'notes' && content.notes && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">📝</span>
                  <h2 className="text-2xl font-bold text-gray-900">Study Notes</h2>
                </div>
                <button
                  onClick={() => generateContent('quiz')}
                  className="px-4 py-2 text-sm rounded-full bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors"
                >
                  Take Quiz →
                </button>
              </div>
              <div className="grid gap-6">
                {content.notes.split('\n\n').map((section, idx) => (
                  <div key={idx}>{renderSection(section)}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}