// src/modules/storage.ts

import type { PocketSupaClient } from '../client.js';

export class StorageModule {
  private client: PocketSupaClient;

  constructor(client: PocketSupaClient) {
    this.client = client;
  }

  from(bucket: string) {
    const _client = this.client;

    return {
      // Upload a file to a file field in a record (supabase style)
      // path can be "recordId/field/filename"
      async upload(path: string, file: File | Blob | ArrayBuffer | Uint8Array, opts?: { recordId?: string, field?: string }) {
        try {
          // Parse path format: "<recordId>/<field>/<filename>"
          let recordId = opts?.recordId, field = opts?.field, filename = "";
          if (!recordId || !field) {
            const parts = path.split("/");
            if (parts.length >= 3) {
              recordId = parts[0]; field = parts[1]; filename = parts.slice(2).join("/");
            } else {
              return { data: null, error: new Error("Path for upload must be in format 'recordId/field/filename'") };
            }
          }

          // Get record (required for form PATCH)
          const getUrl = `${_client.url}/api/collections/${bucket}/records/${encodeURIComponent(recordId)}`;
          const recResp = await fetch(getUrl, {
            headers: { ...(this.client.options?.global?.headers || {}) }
          });
          if (!recResp.ok) {
            return { data: null, error: new Error("No such record for upload") };
          }

          // Prepare multipart/form-data
          const form = new FormData();
          // For PB, field name = field
          let fileObj: any = file;
          if (!(file instanceof File) && !(file instanceof Blob)) {
            // Blob from ArrayBuffer/Uint8Array
            fileObj = new Blob([file]);
          }
          // Filename always required for PB file upload
          const uploadFile = fileObj instanceof File
            ? fileObj
            : new File([fileObj], filename || "upload.bin");
          form.append(field, uploadFile);

          const patchUrl = `${_client.url}/api/collections/${bucket}/records/${encodeURIComponent(recordId)}`;
          const response = await fetch(patchUrl, {
            method: "PATCH",
            headers: {
              ...(this.client.options?.global?.headers || {}),
              "Authorization": this.client.key ? `Bearer ${this.client.key}` : ""
            },
            body: form
          });
          if (!response.ok) {
            let errData = null; try { errData = await response.json(); } catch {};
            return { data: null, error: new Error('PB upload error: ' + ((errData && errData.message) || response.statusText)) };
          }
          const data = await response.json();
          return { data, error: null };
        } catch (e: any) {
          return { data: null, error: e };
        }
      },

      // Download file — forms PB public file url and fetches Blob
      async download(path: string, opts?: { recordId?: string, field?: string, filename?: string }) {
        let recordId = opts?.recordId, field = opts?.field, filename = opts?.filename;
        if (!recordId || !field || !filename) {
          const parts = path.split("/");
          if (parts.length >= 3) {
            recordId = parts[0]; field = parts[1]; filename = parts.slice(2).join("/");
          } else {
            return { data: null, error: new Error("Path for download must be in format 'recordId/field/filename'") };
          }
        }
        const url = `${_client.url}/api/files/${bucket}/${encodeURIComponent(recordId)}/${encodeURIComponent(field)}/${encodeURIComponent(filename)}`;
        try {
          const resp = await fetch(url, {
            headers: { ...(this.client.options?.global?.headers || {}) }
          });
          if (!resp.ok) {
            return { data: null, error: new Error(`Download failed (${resp.status})`) };
          }
          const blob = await resp.blob();
          return { data: blob, error: null };
        } catch (e: any) {
          return { data: null, error: e };
        }
      },

      // Get PB public url for file (does not check file presence)
      getPublicUrl(path: string, opts?: { recordId?: string, field?: string, filename?: string }) {
        let recordId = opts?.recordId, field = opts?.field, filename = opts?.filename;
        if (!recordId || !field || !filename) {
          const parts = path.split("/");
          if (parts.length >= 3) {
            recordId = parts[0]; field = parts[1]; filename = parts.slice(2).join("/");
          } else {
            return { data: null, error: new Error("Path for getPublicUrl must be in format 'recordId/field/filename'") };
          }
        }
        const url = `${_client.url}/api/files/${bucket}/${encodeURIComponent(recordId)}/${encodeURIComponent(field)}/${encodeURIComponent(filename)}`;
        return { data: url, error: null };
      }
    }
  }

  // Stub: PocketBase does not have an explicit bucket concept like supabase,
  // so mimic with dummy createBucket/getBucket that always succeed.
  async createBucket(name: string) {
    return { data: { name }, error: null };
  }
  async getBucket(name: string) {
    return { data: { name }, error: null };
  }
}

