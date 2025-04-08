import { YoutubeTranscript } from 'youtube-transcript';

function getYouTubeVideoId(url: string): string | null {
  const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[7].length === 11) ? match[7] : null;
}

// Proxy configuration
const proxyConfig = {
  host: process.env.PROXY_HOST || 'p.webshare.io',
  port: parseInt(process.env.PROXY_PORT || '80'),
  auth: {
    username: process.env.PROXY_USERNAME || '',
    password: process.env.PROXY_PASSWORD || ''
  }
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

          // Get YouTube transcript with retry mechanism and proxy
          let transcript;
          let retries = 3;
          let lastError;

          while (retries > 0) {
            try {
              // Configure proxy for this request
              const httpsAgent = new (require('https').Agent)({
                proxy: proxyConfig,
                rejectUnauthorized: false
              });

              transcript = await YoutubeTranscript.fetchTranscript(videoId, {
                httpsAgent,
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                  'Accept-Language': 'en-US,en;q=0.5',
                  'Accept-Encoding': 'gzip, deflate, br',
                  'DNT': '1',
                  'Connection': 'keep-alive',
                  'Upgrade-Insecure-Requests': '1',
                  'Sec-Fetch-Dest': 'document',
                  'Sec-Fetch-Mode': 'navigate',
                  'Sec-Fetch-Site': 'none',
                  'Sec-Fetch-User': '?1',
                  'Cache-Control': 'max-age=0',
                  'Referer': 'https://www.youtube.com/',
                  'Origin': 'https://www.youtube.com'
                }
              });
              break;
            } catch (error) {
              lastError = error;
              retries--;
              if (retries > 0) {
                // Wait before retrying with exponential backoff
                await new Promise(resolve => setTimeout(resolve, Math.pow(2, 3 - retries) * 1000));
              }
            }
          }

          if (!transcript) {
            const errorMessage = lastError instanceof Error ? lastError.message : 'Failed to fetch transcript';
            throw new Error(`Failed to fetch transcript after retries: ${errorMessage}`);
          }

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

          if (!fullText) {
            throw new Error('No transcript content found. The video might not have captions enabled.');
          }

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
          const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            error: 'Failed to fetch transcript',
            stage: 'error',
            progress: 0,
            message: errorMessage
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