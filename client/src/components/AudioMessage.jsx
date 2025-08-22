import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Pause, Volume2 } from 'lucide-react';

export function AudioMessage({ audioUrl, audioBase64, mimeType = 'audio/webm', sender = 'user' }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [audioSrc, setAudioSrc] = useState(null);
  const audioRef = useRef(null);

  // Debug props
  console.log('AudioMessage props:', { 
    hasAudioUrl: !!audioUrl, 
    hasAudioBase64: !!audioBase64, 
    audioBase64Length: audioBase64?.length,
    audioBase64Preview: audioBase64?.substring(0, 50),
    mimeType, 
    sender 
  });

  // Debug props only when missing data
  if (!audioUrl && !audioBase64) {
    console.warn('AudioMessage missing audio source:', { audioUrl, audioBase64, sender });
  }

  // Create blob URL from base64 when component mounts
  useEffect(() => {
    if (audioBase64) {
      try {
        // Handle base64 with or without data URL prefix
        let base64Data = audioBase64;
        if (base64Data.startsWith('data:')) {
          base64Data = base64Data.split(',')[1];
        }
        
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: mimeType });
        const blobUrl = URL.createObjectURL(blob);
        setAudioSrc(blobUrl);
        
        return () => {
          URL.revokeObjectURL(blobUrl);
        };
      } catch (error) {
        console.error('Error creating audio blob:', error);
        setIsLoading(false);
      }
    } else if (audioUrl) {
      setAudioSrc(audioUrl);
    }
  }, [audioBase64, audioUrl, mimeType]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audioSrc) return;

    const handleLoadedData = () => {
      setDuration(audio.duration || 0);
      setIsLoading(false);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime || 0);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const handleError = (e) => {
      console.error('Audio loading error:', e);
      setIsLoading(false);
    };

    audio.addEventListener('loadeddata', handleLoadedData);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('loadeddata', handleLoadedData);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
    };
  }, [audioSrc]);

  const togglePlayback = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch(error => {
        console.error('Audio play error:', error);
      });
    }
    setIsPlaying(!isPlaying);
  };

  const formatTime = (time) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className={`
      flex items-center space-x-3 p-3 rounded-lg max-w-xs
      ${sender === 'user' 
        ? 'bg-blue-500 text-white ml-auto' 
        : 'bg-gray-100 text-gray-900'
      }
    `}>
      <audio 
        ref={audioRef} 
        src={audioSrc}
        preload="metadata"
        className="hidden"
      />
      
      <Button
        variant="ghost"
        size="sm"
        onClick={togglePlayback}
        disabled={isLoading}
        className={`
          p-2 rounded-full
          ${sender === 'user' 
            ? 'hover:bg-blue-400 text-white' 
            : 'hover:bg-gray-200 text-gray-900'
          }
        `}
        data-testid="play-audio-button"
      >
        {isLoading ? (
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
        ) : isPlaying ? (
          <Pause className="h-4 w-4" />
        ) : (
          <Play className="h-4 w-4" />
        )}
      </Button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center space-x-2 mb-1">
          <Volume2 className="h-3 w-3" />
          <span className="text-xs font-medium">Áudio</span>
        </div>
        
        {/* Progress bar */}
        <div className="relative bg-white bg-opacity-20 h-1 rounded-full overflow-hidden">
          <div 
            className="absolute left-0 top-0 h-full bg-current transition-all duration-100"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
        
        <div className="flex justify-between text-xs mt-1 opacity-75">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>
    </div>
  );
}