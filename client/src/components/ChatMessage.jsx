import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ChatService } from "@/services/chatService.js";
import { AudioMessage } from "./AudioMessage.jsx";

export function ChatMessage({ message }) {
  const isUser = message.sender === "user";
  const timestamp = ChatService.formatTimestamp(message.timestamp || new Date());

  if (isUser) {
    return (
      <div className="flex items-start justify-end space-x-3" data-testid={`message-${message.id}`}>
        <div className="flex-1 flex justify-end">
          {message.type === 'audio' ? (
            <AudioMessage 
              audioUrl={message.audioUrl} 
              audioBase64={message.audioBase64}
              mimeType={message.mimeType}
              sender="user" 
            />
          ) : (
            <div className="bg-primary text-white rounded-2xl rounded-tr-md px-4 py-3 max-w-md">
              <p className="whitespace-pre-wrap">{message.text || message.content}</p>
            </div>
          )}
        </div>
        <Avatar className="w-8 h-8 flex-shrink-0">
          <AvatarFallback className="bg-gray-300 text-gray-600">
            <i className="fas fa-user text-sm"></i>
          </AvatarFallback>
        </Avatar>
      </div>
    );
  }

  return (
    <div className="flex items-start space-x-3" data-testid={`message-${message.id}`}>
      <Avatar className="w-8 h-8 bg-secondary flex-shrink-0">
        <AvatarFallback className="bg-secondary text-white">
          <i className="fas fa-robot text-sm"></i>
        </AvatarFallback>
      </Avatar>
      <div className="flex-1">
        {message.type === 'audio' ? (
          <div>
            <AudioMessage 
              audioUrl={message.audioUrl} 
              audioBase64={message.audioBase64}
              mimeType={message.mimeType}
              sender="assistant" 
            />
            <div className="text-xs text-gray-500 mt-1 ml-1">{timestamp}</div>
          </div>
        ) : (
          <div>
            <div className="bg-ai-message rounded-2xl rounded-tl-md px-4 py-3 max-w-md">
              <p className="text-gray-800 whitespace-pre-wrap">{message.text || message.content}</p>
            </div>
            <div className="text-xs text-gray-500 mt-1 ml-1">{timestamp}</div>
          </div>
        )}
      </div>
    </div>
  );
}