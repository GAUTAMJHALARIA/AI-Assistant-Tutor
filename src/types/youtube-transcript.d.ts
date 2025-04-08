declare module 'youtube-transcript' {
  interface TranscriptPart {
    text: string;
    start: number;
    duration: number;
  }

  interface TranscriptConfig {
    lang?: string;
    headers?: Record<string, string>;
    httpsAgent?: any;
  }

  class YoutubeTranscript {
    static fetchTranscript(videoId: string, config?: TranscriptConfig): Promise<TranscriptPart[]>;
  }

  export = YoutubeTranscript;
} 