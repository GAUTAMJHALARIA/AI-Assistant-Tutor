import { NextResponse } from 'next/server';
import { YoutubeTranscript } from 'youtube-transcript';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { PythonShell } from 'python-shell';

async function downloadYouTubeVideo(videoId: string): Promise<string> {
  const outputPath = path.join(os.tmpdir(), `${videoId}.mp4`);
  
  return new Promise((resolve, reject) => {
    const ytdl = spawn('yt-dlp', [
      '-f', 'bestaudio[ext=m4a]',
      '-o', outputPath,
      `https://www.youtube.com/watch?v=${videoId}`
    ]);

    ytdl.on('close', (code) => {
      if (code === 0) {
        resolve(outputPath);
      } else {
        reject(new Error(`yt-dlp process exited with code ${code}`));
      }
    });

    ytdl.on('error', (err) => {
      reject(err);
    });
  });
}

type TranscriptionStage = {
  stage: 'preparing' | 'processing' | 'transcribing' | 'finalizing' | 'complete';
  progress: number;
  estimatedTimeRemaining: number;
  message: string;
};

async function transcribeWithWhisper(
  audioPath: string,
  onProgress?: (stage: TranscriptionStage) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    const options = {
      mode: 'text',
      pythonPath: 'python',
      scriptPath: path.join(process.cwd(), 'src', 'lib'),
      args: [audioPath],
      pythonOptions: ['-u'], // Unbuffered output
    };

    let transcript = '';
    let transcriptStarted = false;

    const pythonShell = new PythonShell('transcribe.py', options);

    // Handle output from Python script
    pythonShell.on('message', (message: string) => {
      try {
        // Check if this is the transcript
        if (message.startsWith('TRANSCRIPT_START') && message.endsWith('TRANSCRIPT_END')) {
          transcript = message.slice('TRANSCRIPT_START'.length, -'TRANSCRIPT_END'.length);
          return;
        }

        // Try to parse as JSON for progress updates
        const data = JSON.parse(message);
        
        if (data.error) {
          reject(new Error(data.error));
          return;
        }

        if (data.stage) {
          onProgress?.(data);
        }
      } catch (e) {
        // Ignore non-JSON messages
        console.log('Non-JSON message:', message);
      }
    });

    // Handle completion
    pythonShell.on('close', () => {
      // Clean up the audio file
      try {
        fs.unlinkSync(audioPath);
      } catch (e) {
        console.error('Error cleaning up audio file:', e);
      }

      if (transcript) {
        resolve(transcript);
      } else {
        reject(new Error('No transcript received'));
      }
    });

    // Handle errors
    pythonShell.on('error', (err) => {
      reject(err);
    });
  });
}

function getYouTubeVideoId(url: string): string | null {
  const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[7].length === 11) ? match[7] : null;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const videoUrl = formData.get('videoUrl') as string;
    const videoFile = formData.get('videoFile') as File | null;

    if (videoUrl) {
      // Handle YouTube URL
      const videoId = getYouTubeVideoId(videoUrl);

      if (!videoId) {
        return NextResponse.json(
          { error: 'Invalid YouTube URL' },
          { status: 400 }
        );
      }

      try {
        // First, try to get YouTube's transcript
        const transcript = await YoutubeTranscript.fetchTranscript(videoId);
        const fullText = transcript
          .map(part => part.text)
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();
        
        return new Response(
          `data: ${JSON.stringify({
            transcript: fullText,
            stage: 'complete',
            progress: 100,
            estimatedTimeRemaining: 0,
            message: 'Transcription complete!'
          })}\n\n`,
          {
            headers: {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              'Connection': 'keep-alive',
            },
          }
        );
      } catch (error) {
        // If YouTube transcript fails, fallback to Whisper
        console.log('YouTube transcript not available, falling back to Whisper...');
        
        try {
          const audioPath = await downloadYouTubeVideo(videoId);
          const encoder = new TextEncoder();
          const stream = new ReadableStream({
            async start(controller) {
              try {
                // Send initial progress
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                  stage: 'preparing',
                  progress: 0,
                  estimatedTimeRemaining: 5,
                  message: 'Preparing audio for transcription...'
                })}\n\n`));

                // Transcribe using Whisper with progress updates
                const whisperTranscript = await transcribeWithWhisper(audioPath, (stage) => {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify(stage)}\n\n`));
                });

                // Send final result
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                  transcript: whisperTranscript,
                  stage: 'complete',
                  progress: 100,
                  estimatedTimeRemaining: 0,
                  message: 'Transcription complete!'
                })}\n\n`));
                controller.close();
              } catch (error) {
                controller.error(error);
              }
            },
          });

          return new Response(stream, {
            headers: {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              'Connection': 'keep-alive',
            },
          });
        } catch (whisperError) {
          console.error('Whisper transcription failed:', whisperError);
          return new Response(
            `data: ${JSON.stringify({
              error: 'Failed to transcribe video using both methods',
              stage: 'error',
              progress: 0,
              message: 'Transcription failed'
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
    } else if (videoFile) {
      // Handle uploaded video file
      try {
        const tempDir = os.tmpdir();
        const tempFilePath = path.join(tempDir, `upload-${Date.now()}.mp4`);
        const arrayBuffer = await videoFile.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        fs.writeFileSync(tempFilePath, buffer);

        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          async start(controller) {
            try {
              // Send initial progress
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                stage: 'preparing',
                progress: 0,
                estimatedTimeRemaining: 5,
                message: 'Preparing audio for transcription...'
              })}\n\n`));

              // Transcribe using Whisper with progress updates
              const whisperTranscript = await transcribeWithWhisper(tempFilePath, (stage) => {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(stage)}\n\n`));
              });

              // Send final result
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                transcript: whisperTranscript,
                stage: 'complete',
                progress: 100,
                estimatedTimeRemaining: 0,
                message: 'Transcription complete!'
              })}\n\n`));
              controller.close();
            } catch (error) {
              controller.error(error);
            }
          },
        });

        return new Response(stream, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          },
        });
      } catch (error) {
        console.error('Error processing uploaded video:', error);
        return new Response(
          `data: ${JSON.stringify({
            error: 'Failed to transcribe uploaded video',
            stage: 'error',
            progress: 0,
            message: 'Failed to process video'
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
    } else {
      return new Response(
        `data: ${JSON.stringify({
          error: 'No video URL or file provided',
          stage: 'error',
          progress: 0,
          message: 'No input provided'
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
  } catch (error) {
    console.error('Transcription error:', error);
    return new Response(
      `data: ${JSON.stringify({
        error: 'Failed to process video',
        stage: 'error',
        progress: 0,
        message: error instanceof Error ? error.message : 'An unexpected error occurred'
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