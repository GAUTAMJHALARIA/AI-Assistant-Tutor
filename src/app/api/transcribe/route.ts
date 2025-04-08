import { YoutubeTranscript } from 'youtube-transcript';

function getYouTubeVideoId(url: string): string | null {
  const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[7].length === 11) ? match[7] : null;
}

async function fetchTranscriptWithRetry(videoId: string, maxRetries = 3) {
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Add delay between retries
      if (attempt > 1) {
        await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
      }
      return await YoutubeTranscript.fetchTranscript(videoId);
    } catch (error) {
      lastError = error;
      console.error(`Attempt ${attempt} failed:`, error);
    }
  }
  throw lastError;
}

export const config = {
  api: {
    bodyParser: false,
    responseLimit: '10mb',
    externalResolver: true,
  },
};

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const videoUrl = formData.get('videoUrl') as string;

    if (!videoUrl) {
      return new Response(
        `data: ${JSON.stringify({
          error: 'No video URL provided',
          stage: 'error',
          progress: 0,
          message: 'Please provide a YouTube URL'
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

    const videoId = getYouTubeVideoId(videoUrl);

    if (!videoId) {
      return new Response(
        `data: ${JSON.stringify({
          error: 'Invalid YouTube URL',
          stage: 'error',
          progress: 0,
          message: 'Invalid YouTube URL provided'
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
            message: 'Fetching YouTube transcript...'
          })}\n\n`));

          // Get YouTube transcript with retry logic
          const transcript = await fetchTranscriptWithRetry(videoId);
          
          // Send progress update
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            stage: 'processing',
            progress: 50,
            estimatedTimeRemaining: 2,
            message: 'Processing transcript...'
          })}\n\n`));

          // Combine transcript parts
          const fullText = transcript
            .map(part => part.text)
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();

          // Send final result
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            transcript: fullText,
            stage: 'complete',
            progress: 100,
            estimatedTimeRemaining: 0,
            message: 'Transcription complete!'
          })}\n\n`));
          
          controller.close();
        } catch (error) {
          console.error('Transcription error:', error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          const errorStack = error instanceof Error ? error.stack : '';
          console.error('Error details:', { errorMessage, errorStack });
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            error: 'Failed to fetch transcript',
            stage: 'error',
            progress: 0,
            message: `Could not fetch transcript for this video. Error: ${errorMessage}. Please try another video or check if the video has captions enabled.`
          })}\n\n`));
          controller.close();
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
    console.error('Server error:', error);
    return new Response(
      `data: ${JSON.stringify({
        error: 'Server error',
        stage: 'error',
        progress: 0,
        message: 'An unexpected error occurred. Please try again later.'
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