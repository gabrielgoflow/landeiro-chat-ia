import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

const AUDIO_BUCKET = 'audios';

/**
 * Get Supabase client (lazy initialization)
 */
function getSupabaseClient(): SupabaseClient | null {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!supabaseUrl || !supabaseServiceKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

export class SupabaseStorageService {
  /**
   * Check if Supabase Storage is configured
   */
  isConfigured(): boolean {
    return getSupabaseClient() !== null;
  }

  /**
   * Upload audio file to Supabase Storage
   */
  async uploadAudio(audioBlob: Blob | Buffer, mimeType: string = 'audio/webm'): Promise<string> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      throw new Error('Supabase Storage not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.');
    }

    try {
      const fileId = randomUUID();
      const fileName = `${fileId}.${this.getFileExtension(mimeType)}`;
      
      // Convert Blob to ArrayBuffer if needed
      let fileData: ArrayBuffer;
      if (audioBlob instanceof Buffer) {
        fileData = audioBlob.buffer;
      } else {
        fileData = await audioBlob.arrayBuffer();
      }

      const { data, error } = await supabase.storage
        .from(AUDIO_BUCKET)
        .upload(fileName, fileData, {
          contentType: mimeType,
          upsert: false,
        });

      if (error) {
        throw new Error(`Failed to upload audio: ${error.message}`);
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from(AUDIO_BUCKET)
        .getPublicUrl(fileName);

      return urlData.publicUrl;
    } catch (error: any) {
      console.error('Error uploading audio to Supabase:', error);
      throw error;
    }
  }

  /**
   * Get audio file from Supabase Storage
   */
  async getAudio(filePath: string): Promise<ArrayBuffer> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      throw new Error('Supabase Storage not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.');
    }

    try {
      // Extract file name from URL or path
      const fileName = this.extractFileName(filePath);
      
      const { data, error } = await supabase.storage
        .from(AUDIO_BUCKET)
        .download(fileName);

      if (error) {
        throw new Error(`Failed to download audio: ${error.message}`);
      }

      if (!data) {
        throw new Error('Audio file not found');
      }

      return await data.arrayBuffer();
    } catch (error: any) {
      console.error('Error getting audio from Supabase:', error);
      throw error;
    }
  }

  /**
   * Get public URL for audio file
   */
  getPublicUrl(filePath: string): string {
    const supabase = getSupabaseClient();
    if (!supabase) {
      throw new Error('Supabase Storage not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.');
    }

    const fileName = this.extractFileName(filePath);
    const { data } = supabase.storage
      .from(AUDIO_BUCKET)
      .getPublicUrl(fileName);
    
    return data.publicUrl;
  }

  /**
   * Delete audio file from Supabase Storage
   */
  async deleteAudio(filePath: string): Promise<void> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      throw new Error('Supabase Storage not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.');
    }

    try {
      const fileName = this.extractFileName(filePath);
      
      const { error } = await supabase.storage
        .from(AUDIO_BUCKET)
        .remove([fileName]);

      if (error) {
        throw new Error(`Failed to delete audio: ${error.message}`);
      }
    } catch (error: any) {
      console.error('Error deleting audio from Supabase:', error);
      throw error;
    }
  }

  /**
   * Extract file name from URL or path
   */
  private extractFileName(pathOrUrl: string): string {
    // If it's a full URL, extract the file name
    if (pathOrUrl.startsWith('http')) {
      const url = new URL(pathOrUrl);
      const pathParts = url.pathname.split('/');
      return pathParts[pathParts.length - 1];
    }
    
    // If it's already just a file name, return it
    if (!pathOrUrl.includes('/')) {
      return pathOrUrl;
    }
    
    // Extract file name from path
    const pathParts = pathOrUrl.split('/');
    return pathParts[pathParts.length - 1];
  }

  /**
   * Get file extension from MIME type
   */
  private getFileExtension(mimeType: string): string {
    const mimeToExt: { [key: string]: string } = {
      'audio/webm': 'webm',
      'audio/webm;codecs=opus': 'webm',
      'audio/mpeg': 'mp3',
      'audio/mp3': 'mp3',
      'audio/mp4': 'm4a',
      'audio/m4a': 'm4a',
      'audio/ogg': 'ogg',
      'audio/wav': 'wav',
    };

    return mimeToExt[mimeType] || 'webm';
  }
}

