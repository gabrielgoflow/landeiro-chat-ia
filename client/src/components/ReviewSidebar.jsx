import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

export function ReviewSidebar({ review, isOpen, onClose }) {
  if (!isOpen || !review) return null;

  return (
    <>
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={onClose}
      />
      
      {/* Sidebar */}
      <div className="fixed right-0 top-0 h-full w-96 bg-white shadow-lg z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Review do Atendimento</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <i className="fas fa-times"></i>
          </Button>
        </div>

        {/* Content */}
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-6">
            {/* Resumo do Atendimento */}
            <div>
              <h3 className="font-semibold text-gray-800 mb-2 flex items-center">
                <i className="fas fa-file-alt text-blue-500 mr-2"></i>
                Resumo do Atendimento
              </h3>
              <div className="bg-blue-50 p-3 rounded-lg">
                <p className="text-gray-700 text-sm leading-relaxed">{review.resumoAtendimento}</p>
              </div>
            </div>

            {/* Feedback Direto */}
            <div>
              <h3 className="font-semibold text-gray-800 mb-2 flex items-center">
                <i className="fas fa-comment-medical text-purple-500 mr-2"></i>
                Feedback Direto
              </h3>
              <div className="bg-purple-50 p-3 rounded-lg">
                <p className="text-gray-700 text-sm leading-relaxed">{review.feedbackDireto}</p>
              </div>
            </div>

            {/* Sinais do Paciente */}
            <div>
              <h3 className="font-semibold text-gray-800 mb-2 flex items-center">
                <i className="fas fa-user-injured text-orange-500 mr-2"></i>
                Sinais do Paciente
              </h3>
              <div className="space-y-2">
                {review.sinaisPaciente.map((sinal, index) => (
                  <div key={index} className="bg-orange-50 p-2 rounded border-l-4 border-orange-400">
                    <p className="text-gray-700 text-sm">{sinal}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Pontos Positivos */}
            <div>
              <h3 className="font-semibold text-gray-800 mb-2 flex items-center">
                <i className="fas fa-thumbs-up text-green-500 mr-2"></i>
                Pontos Positivos
              </h3>
              <div className="space-y-2">
                {review.pontosPositivos.map((ponto, index) => (
                  <div key={index} className="bg-green-50 p-2 rounded border-l-4 border-green-400">
                    <p className="text-gray-700 text-sm">{ponto}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Pontos Negativos */}
            <div>
              <h3 className="font-semibold text-gray-800 mb-2 flex items-center">
                <i className="fas fa-thumbs-down text-red-500 mr-2"></i>
                Pontos para Melhoria
              </h3>
              <div className="space-y-2">
                {review.pontosNegativos.map((ponto, index) => (
                  <div key={index} className="bg-red-50 p-2 rounded border-l-4 border-red-400">
                    <p className="text-gray-700 text-sm">{ponto}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="p-4 border-t bg-gray-50">
          <Button 
            onClick={onClose}
            className="w-full"
          >
            Fechar Review
          </Button>
        </div>
      </div>
    </>
  );
}