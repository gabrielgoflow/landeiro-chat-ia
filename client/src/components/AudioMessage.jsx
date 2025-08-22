import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Pause, Volume2, Download } from 'lucide-react';

export function AudioMessage({ audioUrl, audioBase64, mimeType = 'audio/webm', sender = 'user' }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState(null);
  const audioRef = useRef(null);

  // Debug: log audio props
  useEffect(() => {
    console.log('AudioMessage props:', { 
      audioUrl: audioUrl ? 'has URL' : 'no URL', 
      audioBase64: audioBase64 ? 'has base64' : 'no base64', 
      mimeType, 
      sender 
    });
    
    // Show a warning if neither audioUrl nor audioBase64 is available
    if (!audioUrl && !audioBase64) {
      console.warn('AudioMessage: No audio source available (neither URL nor base64)');
    }
  }, [audioUrl, audioBase64, mimeType, sender]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedData = () => {
      setDuration(audio.duration || 0);
      setIsLoading(false);
    };

    const handleLoadedMetadata = () => {
      setDuration(audio.duration || 0);
      setIsLoading(false);
    };

    const handleCanPlay = () => {
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
      console.error('Audio src length:', audio.src ? audio.src.length : 'null');
      console.error('Audio src prefix:', audio.src ? audio.src.substring(0, 100) : 'null');
      
      // Try to decode and validate the base64
      if (audio.src && audio.src.startsWith('data:audio')) {
        try {
          const base64Part = audio.src.split(',')[1];
          if (base64Part) {
            // Test if base64 is valid
            atob(base64Part.substring(0, 100)); // Test first 100 chars
            console.error('Base64 appears valid, might be format/codec issue');
            
            // Create download URL for user as fallback
            setDownloadUrl(audio.src);
          }
        } catch (decodeError) {
          console.error('Base64 decode error:', decodeError);
        }
      }
      
      setHasError(true);
      setIsLoading(false);
    };

    // Reset loading state when audio source changes
    setIsLoading(true);
    console.log('Audio src set to:', audio.src);

    audio.addEventListener('loadeddata', handleLoadedData);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('loadeddata', handleLoadedData);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
    };
  }, [audioUrl, audioBase64]);

  const togglePlayback = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch(error => {
        console.error('Audio play error:', error);
        
        // Try alternative playback method for problematic audio
        if (audioBase64 && audioBase64.startsWith('data:audio')) {
          console.log('Trying alternative audio playback method...');
          
          // Create a new audio element as fallback
          const fallbackAudio = new Audio(audioBase64);
          fallbackAudio.play().catch(fallbackError => {
            console.error('Fallback audio play error:', fallbackError);
            
            // Set download URL as fallback
            setDownloadUrl(audioBase64);
            setHasError(true);
            console.log('Audio playback failed - download option available');
          });
        }
      });
    }
    setIsPlaying(!isPlaying);
  };

  const handleDownload = () => {
    if (downloadUrl) {
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `audio-${sender}-${Date.now()}.mp3`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
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
        src={audioBase64 || audioUrl}
        preload="metadata"
        className="hidden"
      />
      
      <div className="flex space-x-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={togglePlayback}
          disabled={isLoading || hasError}
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
        
        {(hasError && downloadUrl) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDownload}
            className={`
              p-2 rounded-full
              ${sender === 'user' 
                ? 'hover:bg-blue-400 text-white' 
                : 'hover:bg-gray-200 text-gray-900'
              }
            `}
            data-testid="download-audio-button"
            title="Download audio file"
          >
            <Download className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center space-x-2 mb-1">
          <Volume2 className="h-3 w-3" />
          <span className="text-xs font-medium">
            Áudio {hasError && '(Download)'}
          </span>
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