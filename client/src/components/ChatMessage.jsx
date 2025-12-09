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
<<<<<<< HEAD
  const timestamp = ChatService.formatTimestamp(parsedMessage.timestamp || new Date());

  if (isUser) {
    return (
      <div className="flex items-start justify-end space-x-3" data-testid={`message-${parsedMessage.id}`}>
        <div className="flex-1 flex justify-end">
          {parsedMessage.type === 'audio' ? (
            <AudioMessage 
              audioUrl={parsedMessage.audioUrl || parsedMessage.audioURL} 
              audioBase64={parsedMessage.audioBase64}
              mimeType={parsedMessage.mimeType}
              sender="user" 
            />
          ) : (
            <div className="bg-primary text-white rounded-2xl rounded-tr-md px-4 py-3 max-w-md">
              <p className="whitespace-pre-wrap">{parsedMessage.text || parsedMessage.content}</p>
=======
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
              mimeType={parsedMessage.mimeType}
              sender="user"
            />
          ) : (
            <div className="bg-primary text-white rounded-2xl rounded-tr-md px-4 py-3 max-w-md">
              <p className="whitespace-pre-wrap">
                {parsedMessage.text || parsedMessage.content}
              </p>
>>>>>>> 69c3d0b503524c30ad76e469052811a1c79f7321
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
<<<<<<< HEAD
    <div className="flex items-start space-x-3" data-testid={`message-${parsedMessage.id}`}>
=======
    <div
      className="flex items-start space-x-3"
      data-testid={`message-${parsedMessage.id}`}
    >
>>>>>>> 69c3d0b503524c30ad76e469052811a1c79f7321
      <Avatar className="w-8 h-8 bg-secondary flex-shrink-0">
        <AvatarFallback className="bg-secondary text-white">
          <img src="https://nexialab.com.br/wp-content/uploads/2025/10/cropped-favicon-1.png" alt="Logo" className="w-4 h-4" />
        </AvatarFallback>
      </Avatar>
      <div className="flex-1">
<<<<<<< HEAD
        {parsedMessage.type === 'audio' ? (
          <div>
            <AudioMessage 
              audioUrl={parsedMessage.audioUrl || parsedMessage.audioURL} 
              audioBase64={parsedMessage.audioBase64}
              mimeType={parsedMessage.mimeType}
              sender="assistant" 
=======
        {parsedMessage.type === "audio" ? (
          <div>
            <AudioMessage
              audioUrl={parsedMessage.audioUrl || parsedMessage.audioURL}
              mimeType={parsedMessage.mimeType}
              sender="assistant"
>>>>>>> 69c3d0b503524c30ad76e469052811a1c79f7321
            />
            <div className="text-xs text-gray-500 mt-1 ml-1">{timestamp}</div>
          </div>
        ) : (
          <div>
            <div className="bg-ai-message rounded-2xl rounded-tl-md px-4 py-3 max-w-md">
<<<<<<< HEAD
              <p className="text-gray-800 whitespace-pre-wrap">{parsedMessage.text || parsedMessage.content}</p>
=======
              <p className="text-gray-800 whitespace-pre-wrap">
                {parsedMessage.text || parsedMessage.content}
              </p>
>>>>>>> 69c3d0b503524c30ad76e469052811a1c79f7321
            </div>
            <div className="text-xs text-gray-500 mt-1 ml-1">{timestamp}</div>
          </div>
        )}
      </div>
    </div>
  );
}
