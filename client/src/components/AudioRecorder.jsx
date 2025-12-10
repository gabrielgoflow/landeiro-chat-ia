import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Square, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function AudioRecorder({ onAudioSent, disabled = false }) {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordingMimeType, setRecordingMimeType] = useState("audio/webm");
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const { toast } = useToast();

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        },
      });

      // Try MP3 first, fallback to webm
      let mimeType = "audio/webm;codecs=opus";
      let fileExtension = "webm";

      if (MediaRecorder.isTypeSupported("audio/mpeg")) {
        mimeType = "audio/mpeg";
        fileExtension = "mp3";
      } else if (MediaRecorder.isTypeSupported("audio/mp4")) {
        mimeType = "audio/mp4";
        fileExtension = "m4a";
      }

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      setRecordingMimeType(mimeType);

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setAudioBlob(blob);

        // Stop all tracks to release the microphone
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Error starting recording:", error);
      toast({
        title: "Erro ao gravar",
        description: "Não foi possível acessar o microfone",
        variant: "destructive",
      });
    }
  }, [toast]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, [isRecording]);

  const sendAudio = useCallback(async () => {
    if (!audioBlob) return;

    try {
      setIsUploading(true);

      // Upload audio to Storage (Supabase or Replit Object Storage)
      let audioURL = null;
      try {
        // Get upload configuration
        const uploadResponse = await fetch("/api/objects/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });

        if (uploadResponse.ok) {
          const uploadConfig = await uploadResponse.json();

          // Check if we should use Supabase Storage
          if (uploadConfig.useSupabase) {
            // Convert blob to base64 for Supabase upload
            const arrayBuffer = await audioBlob.arrayBuffer();
            const base64Audio = btoa(
              String.fromCharCode(...new Uint8Array(arrayBuffer))
            );

            // Upload directly to Supabase via backend
            const supabaseUploadResponse = await fetch("/api/audio/upload", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                audioBlob: base64Audio,
                mimeType: recordingMimeType,
              }),
            });

            if (supabaseUploadResponse.ok) {
              const { audioURL: uploadedURL, objectPath } = await supabaseUploadResponse.json();
              audioURL = uploadedURL || objectPath;
            } else {
              throw new Error("Falha ao fazer upload para Supabase");
            }
          } else {
            // Use Replit Object Storage (legacy)
            const { uploadURL } = uploadConfig;

            // Upload audio file
            const uploadResult = await fetch(uploadURL, {
              method: "PUT",
              body: audioBlob,
              headers: { "Content-Type": recordingMimeType },
            });

            if (uploadResult.ok) {
              // Set ACL policy for the uploaded audio
              const aclResponse = await fetch("/api/audio-messages", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ audioURL: uploadURL }),
              });

              if (aclResponse.ok) {
                const { objectPath } = await aclResponse.json();
                audioURL = `${window.location.origin}${objectPath}`;
              }
            }
          }
        }
      } catch (uploadError) {
        console.error("Upload failed:", uploadError);
        const errorMessage = uploadError?.message || "Não foi possível fazer upload do áudio";
        toast({
          title: "Erro no upload",
          description: errorMessage.includes("STORAGE_NOT_CONFIGURED") 
            ? "Armazenamento de objetos não configurado. Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no servidor."
            : errorMessage,
          variant: "destructive",
        });
        setIsUploading(false);
        return;
      }

      // Transcribe audio after successful upload (only if upload was successful)
      let transcription = "";
      if (audioURL) {
        try {
          setIsTranscribing(true);
          const transcribeResponse = await fetch("/api/transcribe-audio", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ audioURL }),
          });

          if (transcribeResponse.ok) {
            const { transcription: transcribedText } = await transcribeResponse.json();
            transcription = transcribedText || "";
          } else {
            console.warn("Transcription failed, continuing without transcription");
          }
        } catch (transcribeError) {
          console.error("Error transcribing audio:", transcribeError);
          // Don't block message sending if transcription fails
        } finally {
          setIsTranscribing(false);
        }
      } else {
        // If upload failed, don't try to send the message
        console.error("Cannot send audio: upload failed");
        toast({
          title: "Erro ao enviar",
          description: "Não foi possível fazer upload do áudio. Verifique a configuração do servidor.",
          variant: "destructive",
        });
        setIsUploading(false);
        return;
      }

      // Call the callback with the audio message including transcription
      onAudioSent({
        type: "audio",
        audioURL: audioURL,
        mimeType: recordingMimeType,
        duration: 0, // We could calculate this if needed
        transcription: transcription,
      });

      // Reset state
      setAudioBlob(null);
    } catch (error) {
      console.error("Error sending audio:", error);
      toast({
        title: "Erro ao enviar",
        description: "Não foi possível enviar o áudio",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  }, [audioBlob, onAudioSent, toast, recordingMimeType]);

  const cancelAudio = useCallback(() => {
    setAudioBlob(null);
    toast({
      title: "Áudio cancelado",
      description: "Gravação descartada",
    });
  }, [toast]);

  return (
    <div className="flex items-center space-x-2">
      {!audioBlob ? (
        <Button
          type="button"
          variant={isRecording ? "destructive" : "outline"}
          size="sm"
          onClick={isRecording ? stopRecording : startRecording}
          disabled={disabled || isUploading}
          className="p-2"
          data-testid="record-audio-button"
          title={isRecording ? "Parar gravação" : "Gravar áudio"}
        >
          {isRecording ? (
            <Square className="h-4 w-4" />
          ) : (
            <Mic className="h-4 w-4" />
          )}
        </Button>
      ) : (
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1 px-3 py-1 bg-blue-50 rounded-lg">
            <MicOff className="h-3 w-3 text-blue-600" />
            <span className="text-xs text-blue-600">Áudio gravado</span>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={cancelAudio}
            disabled={isUploading || isTranscribing}
            className="p-1 h-7"
            data-testid="cancel-audio-button"
            title="Cancelar áudio"
          >
            ✕
          </Button>

          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={sendAudio}
            disabled={isUploading || isTranscribing}
            className="p-1 h-7"
            data-testid="send-audio-button"
            title={isTranscribing ? "Transcrevendo áudio..." : "Enviar áudio"}
          >
            {isUploading || isTranscribing ? (
              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white" />
            ) : (
              <Send className="h-3 w-3" />
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
