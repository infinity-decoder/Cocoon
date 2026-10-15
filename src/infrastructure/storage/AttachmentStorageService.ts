/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';

export interface AttachmentMetadata {
  relativePath: string;
  fileName: string;
  fileSizeBytes: number;
  mimeType: string;
  createdAt: string;
}

/**
 * Service managing invoice, bill, and receipt photo attachments.
 * On Android / iOS: Stored in private app storage (context.getFilesDir()) via Capacitor Filesystem (Directory.Data).
 * On Web / Preview: Stored in browser memory / localStorage data-URL cache.
 * SQLite exclusively stores the portable relative path (e.g. "attachments/bills/bill_101.jpg").
 */
export class AttachmentStorageService {
  private static instance: AttachmentStorageService;
  private webMemoryStorage: Map<string, string> = new Map(); // relativePath -> base64Data

  private constructor() {}

  public static getInstance(): AttachmentStorageService {
    if (!AttachmentStorageService.instance) {
      AttachmentStorageService.instance = new AttachmentStorageService();
    }
    return AttachmentStorageService.instance;
  }

  /**
   * Saves a bill or invoice photo to local private storage and returns the portable relative path.
   * @param base64Data Base64-encoded string (with or without data URI prefix)
   * @param folder Subfolder e.g. "invoices", "bills", "receipts"
   * @param preferredFileName e.g. "inv_20261014_01.jpg"
   */
  public async saveAttachment(
    base64Data: string,
    folder: 'invoices' | 'bills' | 'receipts' | 'general' = 'invoices',
    preferredFileName?: string
  ): Promise<string> {
    const cleanBase64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
    const ext = base64Data.includes('image/png') ? 'png' : 'jpg';
    const fileName = preferredFileName || `${folder}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`;
    const relativePath = `attachments/${folder}/${fileName}`;

    if (Capacitor.isNativePlatform()) {
      try {
        // Ensure folder directory exists in context.getFilesDir()
        try {
          await Filesystem.mkdir({
            path: `attachments/${folder}`,
            directory: Directory.Data,
            recursive: true
          });
        } catch {
          // Directory may already exist
        }

        await Filesystem.writeFile({
          path: relativePath,
          data: cleanBase64,
          directory: Directory.Data
        });

        return relativePath;
      } catch (nativeErr) {
        console.error('Failed to write attachment to native private storage:', nativeErr);
        throw new Error(`Failed to save attachment to private storage: ${String(nativeErr)}`);
      }
    } else {
      // Web preview fallback
      this.webMemoryStorage.set(relativePath, cleanBase64);
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(`cocoon_att_${relativePath}`, cleanBase64);
        }
      } catch {
        // LocalStorage quota may be exceeded; in-memory storage remains intact
      }
      return relativePath;
    }
  }

  /**
   * Reads an attachment from private storage and returns a renderable Data URL or WebView URI.
   */
  public async readAttachment(relativePath: string): Promise<string | null> {
    if (!relativePath) return null;

    if (Capacitor.isNativePlatform()) {
      try {
        const fileResult = await Filesystem.readFile({
          path: relativePath,
          directory: Directory.Data
        });
        const mime = relativePath.endsWith('.png') ? 'image/png' : 'image/jpeg';
        return `data:${mime};base64,${fileResult.data}`;
      } catch (err) {
        console.warn(`Could not read attachment from private storage (${relativePath}):`, err);
        return null;
      }
    } else {
      // Web preview fallback
      let data = this.webMemoryStorage.get(relativePath);
      if (!data && typeof localStorage !== 'undefined') {
        data = localStorage.getItem(`cocoon_att_${relativePath}`) || undefined;
      }
      if (!data) return null;
      const mime = relativePath.endsWith('.png') ? 'image/png' : 'image/jpeg';
      return `data:${mime};base64,${data}`;
    }
  }

  /**
   * Deletes an attachment from private storage when an invoice/bill is deleted.
   */
  public async deleteAttachment(relativePath: string): Promise<void> {
    if (!relativePath) return;

    if (Capacitor.isNativePlatform()) {
      try {
        await Filesystem.deleteFile({
          path: relativePath,
          directory: Directory.Data
        });
      } catch {
        // Ignore if already deleted
      }
    } else {
      this.webMemoryStorage.delete(relativePath);
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(`cocoon_att_${relativePath}`);
      }
    }
  }

  /**
   * Lists all stored attachment paths for backup bundling.
   */
  public async listAllAttachmentPaths(): Promise<string[]> {
    if (Capacitor.isNativePlatform()) {
      const paths: string[] = [];
      const folders = ['invoices', 'bills', 'receipts', 'general'];
      for (const folder of folders) {
        try {
          const res = await Filesystem.readdir({
            path: `attachments/${folder}`,
            directory: Directory.Data
          });
          for (const file of res.files) {
            paths.push(`attachments/${folder}/${file.name}`);
          }
        } catch {
          // Folder may not exist
        }
      }
      return paths;
    } else {
      const memoryPaths = Array.from(this.webMemoryStorage.keys());
      if (typeof localStorage !== 'undefined') {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('cocoon_att_')) {
            const rel = key.replace('cocoon_att_', '');
            if (!memoryPaths.includes(rel)) {
              memoryPaths.push(rel);
            }
          }
        }
      }
      return memoryPaths;
    }
  }
}

export const attachmentStorage = AttachmentStorageService.getInstance();
