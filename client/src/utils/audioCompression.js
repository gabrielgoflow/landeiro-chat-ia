// Utilitário para compressão de áudio
export class AudioCompression {
  static async compressAudio(audioBlob, maxSizeMB = 1) {
    try {
      // Verificar tamanho atual
      const currentSizeMB = audioBlob.size / (1024 * 1024);
      console.log(`Tamanho atual do áudio: ${currentSizeMB.toFixed(2)}MB`);

      if (currentSizeMB <= maxSizeMB) {
        console.log("Áudio já está dentro do limite, não precisa comprimir");
        return audioBlob;
      }

      // Para áudio, vamos usar uma abordagem mais simples
      // Reduzir a qualidade do MediaRecorder se possível
      console.log("Tentando comprimir áudio reduzindo qualidade...");

      // Se o áudio ainda for muito grande, vamos truncar
      if (currentSizeMB > maxSizeMB * 2) {
        console.log("Áudio muito grande, truncando...");
        // Criar um novo blob com apenas os primeiros segundos
        const maxBytes = maxSizeMB * 1024 * 1024;
        const truncatedBlob = new Blob([audioBlob.slice(0, maxBytes)], {
          type: audioBlob.type,
        });
        return truncatedBlob;
      }

      // Se não conseguir comprimir, retorna o original
      console.log("Não foi possível comprimir o áudio, usando original");
      return audioBlob;
    } catch (error) {
      console.error("Erro ao comprimir áudio:", error);
      return audioBlob; // Retorna original se falhar
    }
  }

  static async convertToBase64(audioBlob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const result = reader.result;
          if (typeof result === "string" && result.startsWith("data:")) {
            // Retorna o data URL completo (com prefixo)
            resolve(result);
          } else {
            reject(new Error("Formato de dados inválido"));
          }
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = (error) => {
        console.error("Erro ao ler arquivo:", error);
        reject(error);
      };
      reader.readAsDataURL(audioBlob);
    });
  }

  static async prepareAudioForUpload(audioBlob, maxSizeMB = 1) {
    try {
      console.log(
        `Preparando áudio para upload - Tamanho original: ${(audioBlob.size / 1024 / 1024).toFixed(2)}MB`,
      );

      // Comprimir se necessário
      const compressedBlob = await this.compressAudio(audioBlob, maxSizeMB);

      console.log(
        `Áudio comprimido - Tamanho: ${(compressedBlob.size / 1024 / 1024).toFixed(2)}MB`,
      );

      // Converter para base64
      const base64 = await this.convertToBase64(compressedBlob);

      console.log(
        `Base64 gerado - Tamanho: ${(base64.length / 1024 / 1024).toFixed(2)}MB`,
      );

      return {
        audioBase64: base64,
        mimeType: compressedBlob.type || "audio/webm",
        size: compressedBlob.size,
        originalSize: audioBlob.size,
      };
    } catch (error) {
      console.error("Erro ao preparar áudio para upload:", error);
      throw error;
    }
  }

  static getAudioDuration(audioBlob) {
    return new Promise((resolve) => {
      const audio = new Audio();
      audio.onloadedmetadata = () => {
        resolve(audio.duration);
      };
      audio.onerror = () => {
        resolve(0);
      };
      audio.src = URL.createObjectURL(audioBlob);
    });
  }
}
