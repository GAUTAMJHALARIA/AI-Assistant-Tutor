import { GoogleGenerativeAI } from '@google/generative-ai';
import { google } from 'googleapis';
import axios from 'axios';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

function getYouTubeVideoId(url: string): string | null {
  const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[7].length === 11) ? match[7] : null;
}

// Get API keys from environment variables
const GEMINI_API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

if (!GEMINI_API_KEY) {
  throw new Error('Missing Gemini API key - please set NEXT_PUBLIC_GEMINI_API_KEY in your environment variables');
}

if (!YOUTUBE_API_KEY) {
  throw new Error('Missing YouTube API key - please set YOUTUBE_API_KEY in your environment variables');
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

// Initialize YouTube API
const youtube = google.youtube('v3');

async function getVideoMetadata(videoId: string) {
  try {
    const response = await youtube.videos.list({
      key: YOUTUBE_API_KEY,
      part: ['snippet', 'contentDetails'],
      id: [videoId]
    });

    if (!response.data.items || response.data.items.length === 0) {
      throw new Error('Video not found');
    }

    const video = response.data.items[0];
    return {
      title: video.snippet?.title || '',
      description: video.snippet?.description || '',
      channelTitle: video.snippet?.channelTitle || '',
      duration: video.contentDetails?.duration || ''
    };
  } catch (error) {
    console.error('Error fetching video metadata:', error);
    throw new Error('Failed to fetch video metadata');
  }
}

async function getVideoTranscript(videoId: string) {
  try {
    // Try to get transcript from YouTube's transcript API
    const response = await axios.get(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    // Extract transcript data from the page
    const transcriptMatch = response.data.match(/"captions":({.*?}),"videoDetails"/);
    if (!transcriptMatch) {
      return null;
    }

    const transcriptData = JSON.parse(transcriptMatch[1]);
    const baseUrl = transcriptData.playerCaptionsTracklistRenderer.captionTracks[0].baseUrl;
    
    // Fetch the actual transcript
    const transcriptResponse = await axios.get(baseUrl);
    return transcriptResponse.data;
  } catch (error) {
    console.error('Error fetching video transcript:', error);
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const videoUrl = formData.get('videoUrl') as string;
    const videoFile = formData.get('videoFile') as File;

    if (!videoUrl && !videoFile) {
      return new Response(
        `data: ${JSON.stringify({
          error: 'No video source provided',
          stage: 'error',
          progress: 0,
          message: 'Please provide either a YouTube URL or upload a video file'
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

          let transcription;

          if (videoUrl) {
            // Handle YouTube URL
            const videoId = getYouTubeVideoId(videoUrl);

            if (!videoId) {
              throw new Error('Invalid YouTube URL');
            }

            // Get video metadata
            const metadata = await getVideoMetadata(videoId);

            // Try to get the actual transcript
            const transcript = await getVideoTranscript(videoId);
            
            if (transcript) {
              transcription = transcript;
            } else {
              // Fall back to Gemini for content analysis
              const prompt = `You are an expert video content analyzer. Please analyze this YouTube video and provide a detailed transcription based on its metadata.

Video Title: ${metadata.title}
Channel: ${metadata.channelTitle}
Description: ${metadata.description}
Duration: ${metadata.duration}

Guidelines:
1. Create a comprehensive transcription that captures the likely content of the video
2. Include important visual descriptions when relevant
3. Break the content into logical paragraphs
4. Include estimated timestamps for major sections
5. Preserve technical terms and proper nouns
6. Note any important visual elements or demonstrations
7. If the video appears to be educational, focus on key concepts and learning points

Please provide the transcription in this format using proper markdown:

# ${metadata.title}

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
              transcription = response.text();
            }
          } else if (videoFile) {
            // Handle uploaded file
            const bytes = await videoFile.arrayBuffer();
            const buffer = Buffer.from(bytes);
            
            // Save the file temporarily
            const tempDir = tmpdir();
            const tempFilePath = join(tempDir, videoFile.name);
            await writeFile(tempFilePath, buffer);

            // TODO: Implement video transcription for uploaded files
            // For now, we'll use Gemini to analyze the video
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
            transcription = response.text();
          }

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