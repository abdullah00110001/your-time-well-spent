// Native Filesystem Bridge for Capacitor
import { Filesystem, Directory, Encoding, WriteFileResult } from '@capacitor/filesystem';
import { isNative } from './platform';

export interface FileInfo {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  mtime?: number;
}

// Check if we have filesystem access
export async function checkFilesystemPermission(): Promise<boolean> {
  if (!isNative) return true;
  
  try {
    const status = await Filesystem.checkPermissions();
    return status.publicStorage === 'granted';
  } catch (error) {
    console.error('[Filesystem] Permission check failed:', error);
    return false;
  }
}

// Request filesystem permission
export async function requestFilesystemPermission(): Promise<boolean> {
  if (!isNative) return true;
  
  try {
    const status = await Filesystem.requestPermissions();
    return status.publicStorage === 'granted';
  } catch (error) {
    console.error('[Filesystem] Permission request failed:', error);
    return false;
  }
}

// Write text file
export async function writeTextFile(
  path: string,
  content: string,
  directory: Directory = Directory.Documents
): Promise<WriteFileResult | null> {
  try {
    const result = await Filesystem.writeFile({
      path,
      data: content,
      directory,
      encoding: Encoding.UTF8,
      recursive: true,
    });
    return result;
  } catch (error) {
    console.error('[Filesystem] Write text file failed:', error);
    return null;
  }
}

// Write binary file (base64)
export async function writeBinaryFile(
  path: string,
  base64Data: string,
  directory: Directory = Directory.Documents
): Promise<WriteFileResult | null> {
  try {
    const result = await Filesystem.writeFile({
      path,
      data: base64Data,
      directory,
      recursive: true,
    });
    return result;
  } catch (error) {
    console.error('[Filesystem] Write binary file failed:', error);
    return null;
  }
}

// Read text file
export async function readTextFile(
  path: string,
  directory: Directory = Directory.Documents
): Promise<string | null> {
  try {
    const result = await Filesystem.readFile({
      path,
      directory,
      encoding: Encoding.UTF8,
    });
    return result.data as string;
  } catch (error) {
    console.error('[Filesystem] Read text file failed:', error);
    return null;
  }
}

// Read binary file as base64
export async function readBinaryFile(
  path: string,
  directory: Directory = Directory.Documents
): Promise<string | null> {
  try {
    const result = await Filesystem.readFile({
      path,
      directory,
    });
    return result.data as string;
  } catch (error) {
    console.error('[Filesystem] Read binary file failed:', error);
    return null;
  }
}

// Delete file
export async function deleteFile(
  path: string,
  directory: Directory = Directory.Documents
): Promise<boolean> {
  try {
    await Filesystem.deleteFile({
      path,
      directory,
    });
    return true;
  } catch (error) {
    console.error('[Filesystem] Delete file failed:', error);
    return false;
  }
}

// Create directory
export async function createDirectory(
  path: string,
  directory: Directory = Directory.Documents
): Promise<boolean> {
  try {
    await Filesystem.mkdir({
      path,
      directory,
      recursive: true,
    });
    return true;
  } catch (error) {
    console.error('[Filesystem] Create directory failed:', error);
    return false;
  }
}

// List directory contents
export async function listDirectory(
  path: string,
  directory: Directory = Directory.Documents
): Promise<FileInfo[]> {
  try {
    const result = await Filesystem.readdir({
      path,
      directory,
    });
    return result.files.map(file => ({
      name: file.name,
      path: `${path}/${file.name}`,
      type: file.type,
      size: file.size,
      mtime: file.mtime,
    }));
  } catch (error) {
    console.error('[Filesystem] List directory failed:', error);
    return [];
  }
}

// Check if file exists
export async function fileExists(
  path: string,
  directory: Directory = Directory.Documents
): Promise<boolean> {
  try {
    await Filesystem.stat({
      path,
      directory,
    });
    return true;
  } catch {
    return false;
  }
}

// Get file info
export async function getFileInfo(
  path: string,
  directory: Directory = Directory.Documents
): Promise<FileInfo | null> {
  try {
    const stat = await Filesystem.stat({
      path,
      directory,
    });
    return {
      name: path.split('/').pop() || path,
      path,
      type: stat.type,
      size: stat.size,
      mtime: stat.mtime,
    };
  } catch (error) {
    console.error('[Filesystem] Get file info failed:', error);
    return null;
  }
}

// Copy file
export async function copyFile(
  from: string,
  to: string,
  directory: Directory = Directory.Documents
): Promise<boolean> {
  try {
    await Filesystem.copy({
      from,
      to,
      directory,
      toDirectory: directory,
    });
    return true;
  } catch (error) {
    console.error('[Filesystem] Copy file failed:', error);
    return false;
  }
}

// Rename/move file
export async function renameFile(
  from: string,
  to: string,
  directory: Directory = Directory.Documents
): Promise<boolean> {
  try {
    await Filesystem.rename({
      from,
      to,
      directory,
      toDirectory: directory,
    });
    return true;
  } catch (error) {
    console.error('[Filesystem] Rename file failed:', error);
    return false;
  }
}

// Get URI for file
export async function getFileUri(
  path: string,
  directory: Directory = Directory.Documents
): Promise<string | null> {
  try {
    const result = await Filesystem.getUri({
      path,
      directory,
    });
    return result.uri;
  } catch (error) {
    console.error('[Filesystem] Get file URI failed:', error);
    return null;
  }
}

// Download URL to file
export async function downloadToFile(
  url: string,
  path: string,
  directory: Directory = Directory.Documents
): Promise<boolean> {
  try {
    // Fetch the file
    const response = await fetch(url);
    const blob = await response.blob();
    
    // Convert to base64
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = (reader.result as string).split(',')[1];
        const result = await writeBinaryFile(path, base64, directory);
        resolve(result !== null);
      };
      reader.onerror = () => resolve(false);
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('[Filesystem] Download to file failed:', error);
    return false;
  }
}

// Export for offline data storage
export const OfflineStorage = {
  basePath: 'offline_data',
  
  async saveData(key: string, data: any): Promise<boolean> {
    const path = `${this.basePath}/${key}.json`;
    return (await writeTextFile(path, JSON.stringify(data))) !== null;
  },
  
  async loadData<T>(key: string): Promise<T | null> {
    const path = `${this.basePath}/${key}.json`;
    const content = await readTextFile(path);
    if (!content) return null;
    try {
      return JSON.parse(content) as T;
    } catch {
      return null;
    }
  },
  
  async deleteData(key: string): Promise<boolean> {
    const path = `${this.basePath}/${key}.json`;
    return deleteFile(path);
  },
  
  async listKeys(): Promise<string[]> {
    const files = await listDirectory(this.basePath);
    return files
      .filter(f => f.type === 'file' && f.name.endsWith('.json'))
      .map(f => f.name.replace('.json', ''));
  },
};
