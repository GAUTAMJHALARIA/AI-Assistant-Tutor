import sys
import whisper
import json

def transcribe_audio(audio_path):
    try:
        # Load the Whisper model
        print(json.dumps({
            "stage": "preparing",
            "progress": 10,
            "estimatedTimeRemaining": 20,
            "message": "Loading Whisper model..."
        }), flush=True)
        
        model = whisper.load_model("base")
        
        print(json.dumps({
            "stage": "processing",
            "progress": 30,
            "estimatedTimeRemaining": 15,
            "message": "Processing audio file..."
        }), flush=True)
        
        # Transcribe the audio with progress callback
        def progress_callback(progress):
            progress_data = {
                "stage": "transcribing",
                "progress": min(30 + int(progress * 60), 90),  # Scale from 30% to 90%
                "estimatedTimeRemaining": max(1, int((1 - progress) * 30)),
                "message": "Transcribing audio content..."
            }
            print(json.dumps(progress_data), flush=True)
        
        # Transcribe the audio
        result = model.transcribe(audio_path, progress_callback=progress_callback)
        
        # Print final progress
        print(json.dumps({
            "stage": "finalizing",
            "progress": 95,
            "estimatedTimeRemaining": 2,
            "message": "Finalizing transcription..."
        }), flush=True)
        
        # Return the transcribed text with a special marker
        print("TRANSCRIPT_START" + result["text"] + "TRANSCRIPT_END", flush=True)
        return result["text"]
        
    except Exception as e:
        print(json.dumps({
            "error": str(e)
        }), flush=True)
        raise e

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No audio file path provided"}), flush=True)
        sys.exit(1)
    
    audio_path = sys.argv[1]
    try:
        transcribe_audio(audio_path)
    except Exception as e:
        print(json.dumps({"error": str(e)}), flush=True)
        sys.exit(1) 