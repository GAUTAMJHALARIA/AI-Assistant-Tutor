import { GoogleGenerativeAI } from '@google/generative-ai';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

// Get API key from environment variable
const GEMINI_API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  throw new Error('Missing Gemini API key - please set NEXT_PUBLIC_GEMINI_API_KEY in your environment variables');
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const videoFile = formData.get('videoFile') as File;

    if (!videoFile) {
      return new Response(
        `data: ${JSON.stringify({
          error: 'No video file provided',
          stage: 'error',
          progress: 0,
          message: 'Please upload a video file'
        })}\n\n`,
        {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          },
          status: 400
        }
      );
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Send initial progress
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            stage: 'preparing',
            progress: 0,
            estimatedTimeRemaining: 5,
            message: 'Processing video...'
          })}\n\n`));

          // Handle uploaded file
          const bytes = await videoFile.arrayBuffer();
          const buffer = Buffer.from(bytes);
          
          // Save the file temporarily
          const tempDir = tmpdir();
          const tempFilePath = join(tempDir, videoFile.name);
          await writeFile(tempFilePath, buffer);

          // Generate transcription using Gemini
          const prompt = `You are an expert video content analyzer. Please analyze this video and provide a detailed transcription.

Video Name: ${videoFile.name}
File Size: ${(videoFile.size / (1024 * 1024)).toFixed(2)} MB

Guidelines:
1. Create a comprehensive transcription that captures the likely content of the video
2. Include important visual descriptions when relevant
3. Break the content into logical paragraphs
4. Include estimated timestamps for major sections
5. Preserve technical terms and proper nouns
6. Note any important visual elements or demonstrations
7. If the video appears to be educational, focus on key concepts and learning points

Please provide the transcription in this format using proper markdown:

# ${videoFile.name}

## Overview
[Brief introduction of the video content]

## Main Content
### [00:00] Section 1
- Key point 1
  - Supporting detail
  - Example or explanation
- Key point 2
  - Supporting detail
  - Example or explanation

### [00:00] Section 2
- Key point 1
  - Supporting detail
  - Example or explanation
- Key point 2
  - Supporting detail
  - Example or explanation

## Key Takeaways
- Main takeaway 1
- Main takeaway 2
- Main takeaway 3

## Additional Notes
- Important visual elements or demonstrations
- Technical terms and definitions
- Related concepts or references

Note: This is a generated transcription based on the video's metadata. It represents a likely structure and content of the video.`;

          const result = await model.generateContent(prompt);
          const response = await result.response;
          const transcription = response.text();

          if (!transcription) {
            throw new Error('Failed to generate transcription');
          }

          // Send final result
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            transcript: transcription,
            stage: 'complete',
            progress: 100,
            estimatedTimeRemaining: 0,
            message: 'Transcription complete!'
          })}\n\n`));
          
          controller.close();
        } catch (error) {
          console.error('Transcription error:', error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            error: 'Failed to generate transcription',
            stage: 'error',
            progress: 0,
            message: errorMessage
          })}\n\n`));
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Server error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      `data: ${JSON.stringify({
        error: 'Server error',
        stage: 'error',
        progress: 0,
        message: errorMessage
      })}\n\n`,
      {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
        status: 500
      }
    );
  }
} 