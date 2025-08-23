import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ChatService } from "@/services/chatService.js";
import { AudioMessage } from "./AudioMessage.jsx";

export function ChatMessage({ message }) {
  console.log("ChatMessage:", message);
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

  if (isUser) {
    return (
      <div
        className="flex items-start justify-end space-x-3"
        data-testid={`message-${parsedMessage.id}`}
      >
        <div className="flex-1 flex justify-end">
          {parsedMessage.type === "audio" ? (
            <AudioMessage
              audioUrl={parsedMessage.audioUrl || parsedMessage.audioURL}
              audioBase64={parsedMessage.audioBase64}
              mimeType={parsedMessage.mimeType}
              sender="user"
            />
          ) : (
            <div className="bg-primary text-white rounded-2xl rounded-tr-md px-4 py-3 max-w-md">
              <p className="whitespace-pre-wrap">
                {parsedMessage.text || parsedMessage.content}
              </p>
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
    <div
      className="flex items-start space-x-3"
      data-testid={`message-${parsedMessage.id}`}
    >
      <Avatar className="w-8 h-8 bg-secondary flex-shrink-0">
        <AvatarFallback className="bg-secondary text-white">
          <i className="fas fa-robot text-sm"></i>
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
            <div className="text-xs text-gray-500 mt-1 ml-1">{timestamp}</div>
          </div>
        ) : (
          <div>
            <div className="bg-ai-message rounded-2xl rounded-tl-md px-4 py-3 max-w-md">
              <p className="text-gray-800 whitespace-pre-wrap">
                {parsedMessage.text || parsedMessage.content}
              </p>
            </div>
            <div className="text-xs text-gray-500 mt-1 ml-1">{timestamp}</div>
          </div>
        )}
      </div>
    </div>
  );
}
