'use client';

import { useState, useRef } from 'react';
import { ReactSketchCanvas, ReactSketchCanvasRef } from 'react-sketch-canvas';
import Image from 'next/image';
import { generateMathSolution, generateMathSolutionFromImage } from '@/lib/math-api';
import ReactMarkdown from 'react-markdown';
import ChatInterface from '@/components/ChatInterface';

type InputMethod = 'draw' | 'upload' | 'text';
type Solution = {
  steps: string;
  explanation: string;
  chatHistory?: { role: 'user' | 'assistant'; content: string; }[];
};

export default function MathSolver() {
  const [activeMethod, setActiveMethod] = useState<InputMethod>('draw');
  const [solution, setSolution] = useState<Solution | null>(null);
  const [loading, setLoading] = useState(false);
  const [question, setQuestion] = useState('');
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [strokeColor, setStrokeColor] = useState('#000000');
  const [isEraser, setIsEraser] = useState(false);
  const [strokeWidth, setStrokeWidth] = useState(4);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const canvasRef = useRef<ReactSketchCanvasRef>(null);

  const handleClearCanvas = () => {
    canvasRef.current?.clearCanvas();
  };

  const handleUndo = () => {
    canvasRef.current?.undo();
  };

  const handleRedo = () => {
    canvasRef.current?.redo();
  };

  const handleResetCanvas = () => {
    canvasRef.current?.resetCanvas();
  };

  const handleEraser = () => {
    setIsEraser(!isEraser);
    setStrokeColor(isEraser ? '#000000' : '#ffffff');
  };

  const handleSolve = async () => {
    try {
      setLoading(true);
      let result;

      switch (activeMethod) {
        case 'draw':
          if (!canvasRef.current) break;
          const imageData = await canvasRef.current!.exportImage('jpeg');
          result = await generateMathSolutionFromImage(imageData);
          break;

        case 'upload':
          if (!uploadedImage) break;
          result = await generateMathSolutionFromImage(uploadedImage);
          break;

        case 'text':
          if (!question.trim()) break;
          result = await generateMathSolution(question);
          break;
      }

      if (result) {
        setSolution(result);
      }
    } catch (error) {
      console.error('Error solving math problem:', error);
      // You might want to show an error message to the user here
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Math Problem Solver</h1>
        <p className="text-gray-600">Draw, upload, or type your math problem to get step-by-step solutions</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex space-x-4 mb-6">
          {(['draw', 'upload', 'text'] as InputMethod[]).map((method) => (
            <button
              key={method}
              onClick={() => setActiveMethod(method)}
              className={`px-4 py-2 rounded-lg font-medium ${
                activeMethod === method
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
              }`}
            >
              {method === 'draw' && '✏️ Draw'}
              {method === 'upload' && '📤 Upload'}
              {method === 'text' && '✍️ Type'}
            </button>
          ))}
        </div>

        <div className="mb-6">
          {activeMethod === 'draw' && (
            <div>
              <div className="flex items-center space-x-4 mb-4">
                <div className="flex items-center space-x-2">
                  <label htmlFor="color-picker" className="text-sm text-gray-600">Color:</label>
                  <input
                    id="color-picker"
                    type="color"
                    value={isEraser ? '#ffffff' : strokeColor}
                    onChange={(e) => {
                      setStrokeColor(e.target.value);
                      setIsEraser(false);
                    }}
                    className="w-8 h-8 rounded cursor-pointer"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <label htmlFor="stroke-width" className="text-sm text-gray-600">Width:</label>
                  <input
                    id="stroke-width"
                    type="range"
                    min="1"
                    max="20"
                    value={strokeWidth}
                    onChange={(e) => setStrokeWidth(parseInt(e.target.value))}
                    className="w-32"
                  />
                </div>
                <button
                  onClick={handleEraser}
                  className={`px-3 py-1 rounded ${
                    isEraser ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  ⌫ Eraser
                </button>
                <button
                  onClick={handleUndo}
                  className="px-3 py-1 rounded bg-gray-100 text-gray-700 hover:bg-gray-200"
                >
                  ↩ Undo
                </button>
                <button
                  onClick={handleRedo}
                  className="px-3 py-1 rounded bg-gray-100 text-gray-700 hover:bg-gray-200"
                >
                  ↪ Redo
                </button>
                <button
                  onClick={handleClearCanvas}
                  className="px-3 py-1 rounded bg-gray-100 text-gray-700 hover:bg-gray-200"
                >
                  🗑 Clear
                </button>
                <button
                  onClick={handleResetCanvas}
                  className="px-3 py-1 rounded bg-gray-100 text-gray-700 hover:bg-gray-200"
                >
                  🔄 Reset
                </button>
              </div>
              <div className="border rounded-lg overflow-hidden bg-white">
                <ReactSketchCanvas
                  ref={canvasRef}
                  width="100%"
                  height="400px"
                  strokeWidth={strokeWidth}
                  strokeColor={strokeColor}
                  backgroundImage=""
                  exportWithBackgroundImage={true}
                  preserveBackgroundImageAspectRatio="none"
                  allowOnlyPointerType="all"
                />
              </div>
            </div>
          )}

          {activeMethod === 'upload' && (
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
                id="image-upload"
              />
              <label
                htmlFor="image-upload"
                className="cursor-pointer block"
              >
                {uploadedImage ? (
                  <div className="relative w-full h-[400px]">
                    <Image
                      src={uploadedImage}
                      alt="Uploaded math problem"
                      fill
                      className="object-contain"
                    />
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
                    <p className="mt-1">Click to upload an image</p>
                  </div>
                )}
              </label>
            </div>
          )}

          {activeMethod === 'text' && (
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Type your math problem here (e.g., 'Solve for x: 2x + 5 = 15')"
              className="w-full h-40 p-4 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          )}
        </div>

        <div className="flex justify-center">
          <button
            onClick={handleSolve}
            disabled={loading}
            className={`px-6 py-3 rounded-lg font-medium text-white ${loading
              ? 'bg-indigo-400 cursor-not-allowed'
              : 'bg-indigo-600 hover:bg-indigo-700'
              }`}
          >
            {loading ? 'Solving...' : '🧮 Solve Problem'}
          </button>
        </div>
      </div>

      {solution && (
        <>
          <div className="mt-8 bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Solution</h2>
            <div className="prose prose-indigo max-w-none">
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-medium text-gray-900 mb-3">Step-by-Step Solution:</h3>
                  <div className="bg-gray-50 p-6 rounded-lg">
                    <div className="text-gray-800">
                      <ReactMarkdown>
                        {solution.steps}
                      </ReactMarkdown>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-xl font-medium text-gray-900 mb-3">Detailed Explanation:</h3>
                  <div className="bg-gray-50 p-6 rounded-lg">
                    <div className="text-gray-800 leading-relaxed">
                      <ReactMarkdown>
                        {solution.explanation}
                      </ReactMarkdown>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <ChatInterface initialHistory={solution.chatHistory} />
        </>
      )}
    </div>
  );
}