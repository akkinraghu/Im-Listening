/**
 * Service for handling DeepGram live transcription using the official SDK
 */
import { createClient, LiveTranscriptionEvents } from "@deepgram/sdk";

interface TranscriptionResult {
  transcript: string;
  isFinal: boolean;
  confidence: number;
  words: Array<{
    word: string;
    start: number;
    end: number;
    confidence: number;
  }>;
}

class DeepgramService {
  private deepgram: ReturnType<typeof createClient> | null = null;
  private connection: any = null;
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private apiKey: string | null = null;
  private options: any = {
    language: "en-US",
    punctuate: true,
    smart_format: true,
  };
  private onTranscriptionCallback:
    | ((result: TranscriptionResult) => void)
    | null = null;
  private onErrorCallback: ((error: Error) => void) | null = null;
  private onStatusChangeCallback:
    | ((
        status:
          | "connecting"
          | "connected"
          | "disconnected"
          | "recording"
          | "error"
      ) => void)
    | null = null;

  /**
   * Initialize the DeepGram service with configuration
   */
  async initialize(): Promise<boolean> {
    try {
      // In a production app, we would fetch a token from the server
      // For now, we'll use the API key directly in the client for demo purposes
      this.apiKey = process.env.NEXT_PUBLIC_DEEPGRAM_API_KEY || "";

      if (!this.apiKey) {
        // Try to fetch from our API
        const response = await fetch("/api/transcription/socket");
        const data = await response.json();

        if (!data.configured) {
          throw new Error("DeepGram is not properly configured");
        }
      }

      // Initialize the DeepGram client
      this.deepgram = createClient(this.apiKey);

      return true;
    } catch (error) {
      console.error("Failed to initialize DeepGram service:", error);
      this.handleError(error as Error);
      return false;
    }
  }

  /**
   * Set options for transcription
   */
  setOptions(options: any): void {
    this.options = { ...this.options, ...options };
  }

  /**
   * Set callback for transcription results
   */
  onTranscription(callback: (result: TranscriptionResult) => void): void {
    this.onTranscriptionCallback = callback;
  }

  /**
   * Set callback for errors
   */
  onError(callback: (error: Error) => void): void {
    this.onErrorCallback = callback;
  }

  /**
   * Set callback for status changes
   */
  onStatusChange(
    callback: (
      status:
        | "connecting"
        | "connected"
        | "disconnected"
        | "recording"
        | "error"
    ) => void
  ): void {
    this.onStatusChangeCallback = callback;
  }

  /**
   * Start recording and transcribing
   */
  async startRecording(): Promise<void> {
    if (!this.deepgram) {
      throw new Error("DeepGram service not initialized");
    }

    try {
      // Request microphone access
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.updateStatus("connecting");

      // Create a live transcription connection
      const connection = this.deepgram.listen.live(this.options);
      this.connection = connection;

      // Set up event handlers
      connection.on(LiveTranscriptionEvents.Open, () => {
        this.updateStatus("connected");
        this.startMediaRecorder();
      });

      connection.on(LiveTranscriptionEvents.Close, () => {
        this.updateStatus("disconnected");
        this.stopMediaRecorder();
      });

      connection.on(LiveTranscriptionEvents.Error, (error) => {
        console.error("DeepGram error:", error);
        this.handleError(new Error("DeepGram connection error"));
      });

      connection.on(LiveTranscriptionEvents.Transcript, (data) => {
        try {
          const channel = data.channel;
          const alternatives = channel.alternatives;

          if (alternatives && alternatives.length > 0) {
            const transcript = alternatives[0].transcript;

            if (transcript) {
              const result: TranscriptionResult = {
                transcript,
                isFinal: data.is_final,
                confidence: alternatives[0].confidence || 0,
                words: alternatives[0].words || [],
              };

              if (this.onTranscriptionCallback) {
                this.onTranscriptionCallback(result);
              }
            }
          }
        } catch (error) {
          console.error("Error parsing DeepGram transcript:", error);
        }
      });
    } catch (error) {
      console.error("Error starting recording:", error);
      this.handleError(error as Error);
    }
  }

  /**
   * Stop recording and transcribing
   */
  stopRecording(): void {
    this.stopMediaRecorder();

    if (this.connection) {
      this.connection.finish();
      this.connection = null;
    }

    this.updateStatus("disconnected");
  }

  /**
   * Start the media recorder
   */
  private startMediaRecorder(): void {
    if (!this.stream || !this.connection) return;

    // Create a MediaRecorder to capture audio
    this.mediaRecorder = new MediaRecorder(this.stream);

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0 && this.connection) {
        // Convert the audio data to the format DeepGram expects
        event.data.arrayBuffer().then((buffer) => {
          if (this.connection) {
            this.connection.send(buffer);
          }
        });
      }
    };

    this.mediaRecorder.start(100); // Collect data every 100ms
    this.updateStatus("recording");
  }

  /**
   * Stop the media recorder
   */
  private stopMediaRecorder(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      this.mediaRecorder.stop();
      this.mediaRecorder = null;
    }

    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
  }

  /**
   * Handle errors
   */
  private handleError(error: Error): void {
    this.updateStatus("error");

    if (this.onErrorCallback) {
      this.onErrorCallback(error);
    }
  }

  /**
   * Update status and trigger callback
   */
  private updateStatus(
    status: "connecting" | "connected" | "disconnected" | "recording" | "error"
  ): void {
    if (this.onStatusChangeCallback) {
      this.onStatusChangeCallback(status);
    }
  }
}

// Export a singleton instance
export const deepgramService = new DeepgramService();
