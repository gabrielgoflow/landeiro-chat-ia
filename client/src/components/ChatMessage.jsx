import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ChatService } from "@/services/chatService.js";
import { AudioMessage } from "./AudioMessage.jsx";

export function ChatMessage({ message }) {
  // console.log("ChatMessage:", message); // Removido para evitar logs excessivos
  let parsedMessage = message;
  if (typeof message.content === "string" && message.content.startsWith("{")) {
    try {
      const contentObj = JSON.parse(message.content);
      parsedMessage = { ...message, ...contentObj };
    } catch (e) {
      // Se não for JSON válido, mantém como está
    }
  }
  const isUser = parsedMessage.sender === "user";
  const timestamp = ChatService.formatTimestamp(
    parsedMessage.timestamp || new Date(),
  );
  
  // Debug: log transcription for audio messages
  if (parsedMessage.type === "audio" && isUser) {
    console.log("Audio message transcription:", parsedMessage.transcription);
  }

  if (isUser) {
    return (
      <div
        className="flex items-start justify-end space-x-2 sm:space-x-3"
        data-testid={`message-${parsedMessage.id}`}
      >
        <div className="flex-1 flex justify-end">
          {parsedMessage.type === "audio" ? (
            <div className="flex flex-col items-end space-y-1.5 sm:space-y-2 max-w-md">
              <AudioMessage
                audioUrl={parsedMessage.audioUrl || parsedMessage.audioURL}
                audioBase64={parsedMessage.audioBase64}
                mimeType={parsedMessage.mimeType}
                sender="user"
              />
              {parsedMessage.transcription && parsedMessage.transcription.trim() ? (
                <div className="bg-gray-50 border border-gray-200 rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 max-w-full shadow-sm">
                  <div className="flex items-center space-x-1 mb-0.5 sm:mb-1">
                    <i className="fas fa-text-width text-[10px] sm:text-xs text-gray-500"></i>
                    <span className="text-[10px] sm:text-xs font-medium text-gray-600">Transcrição:</span>
                  </div>
                  <p className="text-xs sm:text-sm text-gray-800 whitespace-pre-wrap">
                    {parsedMessage.transcription}
                  </p>
                </div>
              ) : (
                parsedMessage.transcription === "" && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 max-w-full">
                    <p className="text-[10px] sm:text-xs text-yellow-700 italic">
                      Transcrição não disponível
                    </p>
                  </div>
                )
              )}
            </div>
          ) : (
            <div className="bg-primary text-white rounded-2xl rounded-tr-md px-3 sm:px-4 py-2 sm:py-3 max-w-md">
              <p className="text-sm sm:text-base whitespace-pre-wrap">
                {parsedMessage.text || parsedMessage.content}
              </p>
            </div>
          )}
        </div>
        <Avatar className="w-6 h-6 sm:w-8 sm:h-8 flex-shrink-0">
          <AvatarFallback className="bg-gray-300 text-gray-600">
            <i className="fas fa-user text-xs sm:text-sm"></i>
          </AvatarFallback>
        </Avatar>
      </div>
    );
  }

  return (
    <div
      className="flex items-start space-x-2 sm:space-x-3"
      data-testid={`message-${parsedMessage.id}`}
    >
      <Avatar className="w-6 h-6 sm:w-8 sm:h-8 bg-secondary flex-shrink-0">
        <AvatarFallback className="bg-secondary text-white">
          <img src="https://nexialab.com.br/wp-content/uploads/2025/10/cropped-favicon-1.png" alt="Logo" className="w-3 h-3 sm:w-4 sm:h-4" />
        </AvatarFallback>
      </Avatar>
      <div className="flex-1">
        {parsedMessage.type === "audio" ? (
          <div>
            <AudioMessage
              audioUrl={parsedMessage.audioUrl || parsedMessage.audioURL}
              audioBase64={parsedMessage.audioBase64}
              mimeType={parsedMessage.mimeType}
              sender="assistant"
            />
            <div className="text-[10px] sm:text-xs text-gray-500 mt-1 ml-1">{timestamp}</div>
          </div>
        ) : (
          <div>
            <div className="bg-ai-message rounded-2xl rounded-tl-md px-3 sm:px-4 py-2 sm:py-3 max-w-md">
              <p className="text-sm sm:text-base text-gray-800 whitespace-pre-wrap">
                {parsedMessage.text || parsedMessage.content}
              </p>
            </div>
            <div className="text-[10px] sm:text-xs text-gray-500 mt-1 ml-1">{timestamp}</div>
          </div>
        )}
      </div>
    </div>
  );
}
