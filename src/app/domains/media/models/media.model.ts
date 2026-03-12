export interface MediaMetadata {
  id: string;
  fileName: string;
  mimeType: string;
  createdAt: Date;
}

export interface MediaData extends MediaMetadata {
  data: Uint8Array;
}
