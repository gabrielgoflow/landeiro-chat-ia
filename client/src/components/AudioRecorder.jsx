import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Square, Send } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function AudioRecorder({ onAudioSent, disabled = false }) {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const { toast } = useToast();

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        } 
      });
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        
        // Stop all tracks to release the microphone
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorder.start();
      setIsRecording(true);
      
      toast({
        title: 'Gravação iniciada',
        description: 'Fale sua mensagem...'
      });
    } catch (error) {
      console.error('Error starting recording:', error);
      toast({
        title: 'Erro ao gravar',
        description: 'Não foi possível acessar o microfone',
        variant: 'destructive'
      });
    }
  }, [toast]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      toast({
        title: 'Gravação finalizada',
        description: 'Clique em enviar para mandar o áudio'
      });
    }
  }, [isRecording, toast]);

  const sendAudio = useCallback(async () => {
    if (!audioBlob) return;

    try {
      setIsUploading(true);

      // Get upload URL
      const uploadResponse = await fetch('/api/objects/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to get upload URL');
      }

      const { uploadURL } = await uploadResponse.json();

      // Upload audio file
      const uploadResult = await fetch(uploadURL, {
        method: 'PUT',
        body: audioBlob,
        headers: {
          'Content-Type': 'audio/webm'
        }
      });

      if (!uploadResult.ok) {
        throw new Error('Failed to upload audio');
      }

      // Set ACL policy for the uploaded audio
      const aclResponse = await fetch('/api/audio-messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          audioURL: uploadURL
        })
      });

      if (!aclResponse.ok) {
        throw new Error('Failed to set audio permissions');
      }

      const { objectPath } = await aclResponse.json();

      // Call the callback with the audio message
      onAudioSent({
        type: 'audio',
        audioUrl: objectPath,
        duration: 0 // We could calculate this if needed
      });

      // Reset state
      setAudioBlob(null);
      
      toast({
        title: 'Áudio enviado',
        description: 'Sua mensagem de áudio foi enviada com sucesso'
      });

    } catch (error) {
      console.error('Error sending audio:', error);
      toast({
        title: 'Erro ao enviar',
        description: 'Não foi possível enviar o áudio',
        variant: 'destructive'
      });
    } finally {
      setIsUploading(false);
    }
  }, [audioBlob, onAudioSent, toast]);

  const cancelAudio = useCallback(() => {
    setAudioBlob(null);
    toast({
      title: 'Áudio cancelado',
      description: 'Gravação descartada'
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
            disabled={isUploading}
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
            disabled={isUploading}
            className="p-1 h-7"
            data-testid="send-audio-button"
            title="Enviar áudio"
          >
            {isUploading ? (
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