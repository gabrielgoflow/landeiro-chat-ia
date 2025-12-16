import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ChatService } from "@/services/chatService";
import type { Message } from "@shared/schema";

interface ChatMessageProps {
  message: Message;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.sender === "user";
  const timestamp = ChatService.formatTimestamp(message.timestamp || new Date());

  if (isUser) {
    return (
      <div className="flex items-start justify-end space-x-2 sm:space-x-3" data-testid={`message-${message.id}`}>
        <div className="flex-1 flex justify-end">
          <div className="bg-primary text-white rounded-2xl rounded-tr-md px-3 sm:px-4 py-2 sm:py-3 max-w-md">
            <p className="text-sm sm:text-base whitespace-pre-wrap">{message.content}</p>
          </div>
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
    <div className="flex items-start space-x-2 sm:space-x-3" data-testid={`message-${message.id}`}>
      <Avatar className="w-6 h-6 sm:w-8 sm:h-8 bg-secondary flex-shrink-0">
        <AvatarFallback className="bg-secondary text-white">
          <img src="https://nexialab.com.br/wp-content/uploads/2025/10/cropped-favicon-1.png" alt="Logo" className="w-3 h-3 sm:w-4 sm:h-4" />
        </AvatarFallback>
      </Avatar>
      <div className="flex-1">
        <div className="bg-ai-message rounded-2xl rounded-tl-md px-3 sm:px-4 py-2 sm:py-3 max-w-md">
          <p className="text-sm sm:text-base text-gray-800 whitespace-pre-wrap">{message.content}</p>
        </div>
        <div className="text-[10px] sm:text-xs text-gray-500 mt-1 ml-1">{timestamp}</div>
      </div>
    </div>
  );
}
