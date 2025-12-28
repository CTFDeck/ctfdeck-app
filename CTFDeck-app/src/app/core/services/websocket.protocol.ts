/**
 * Binary Protocol Utilities for CtfDeck
 * Handles UUID conversion and binary serialization/deserialization
 */

export interface CommandResponse {
  exitCode: number;
  output: string;
  error: string;
  messageId: string;
}

/**
 * Converts a UUID string to .NET Guid byte format (16 bytes)
 * .NET Guids use mixed endianness:
 * - First 4 bytes: Little Endian
 * - Next 2 bytes: Little Endian
 * - Next 2 bytes: Little Endian
 * - Last 8 bytes: Big Endian
 */
export function uuidToBytes(uuid: string): Uint8Array {
  const hex = uuid.replace(/-/g, '');
  const bytes = new Uint8Array(16);

  // First 4 bytes (int32) - Little Endian
  bytes[0] = parseInt(hex.substring(6, 8), 16);
  bytes[1] = parseInt(hex.substring(4, 6), 16);
  bytes[2] = parseInt(hex.substring(2, 4), 16);
  bytes[3] = parseInt(hex.substring(0, 2), 16);

  // Next 2 bytes (int16) - Little Endian
  bytes[4] = parseInt(hex.substring(10, 12), 16);
  bytes[5] = parseInt(hex.substring(8, 10), 16);

  // Next 2 bytes (int16) - Little Endian
  bytes[6] = parseInt(hex.substring(14, 16), 16);
  bytes[7] = parseInt(hex.substring(12, 14), 16);

  // Last 8 bytes - Big Endian
  for (let i = 0; i < 8; i++) {
    bytes[8 + i] = parseInt(hex.substring(16 + i * 2, 18 + i * 2), 16);
  }

  return bytes;
}

/**
 * Converts .NET Guid bytes back to UUID string
 */
export function bytesToUuid(bytes: Uint8Array): string {
  if (bytes.length !== 16) {
    throw new Error('Invalid UUID byte length');
  }

  const hex: string[] = [];

  // Helper to push hex string
  const pushHex = (b: number) => hex.push(b.toString(16).padStart(2, '0'));

  // First 4 bytes (Little Endian) -> 3 2 1 0
  pushHex(bytes[3]);
  pushHex(bytes[2]);
  pushHex(bytes[1]);
  pushHex(bytes[0]);
  hex.push('-');

  // Next 2 bytes (Little Endian) -> 5 4
  pushHex(bytes[5]);
  pushHex(bytes[4]);
  hex.push('-');

  // Next 2 bytes (Little Endian) -> 7 6
  pushHex(bytes[7]);
  pushHex(bytes[6]);
  hex.push('-');

  // Last 8 bytes (Big Endian) -> 8 9 10 11 - 12 13 14 15
  pushHex(bytes[8]);
  pushHex(bytes[9]);
  hex.push('-');

  for (let i = 10; i < 16; i++) {
    pushHex(bytes[i]);
  }

  return hex.join('');
}

/**
 * Generates a v4 UUID
 */
export function generateUUID(): string {
  // Simple UUID v4 generator if crypto.randomUUID is not available in all contexts (though it should be in modern browsers)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  // Fallback
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0,
      v = c == 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Serializes a command to binary format
 * Format: [cmd_len: int32 LE] [cmd_bytes: utf8] [message_id: 16 bytes]
 */
export function serializeCommand(command: string, messageId: string): Uint8Array {
  const encoder = new TextEncoder();
  const commandBytes = encoder.encode(command);
  const commandLength = commandBytes.length;
  const messageIdBytes = uuidToBytes(messageId);

  // Total size: 4 (len) + N (cmd) + 16 (id)
  const totalSize = 4 + commandLength + 16;
  const buffer = new Uint8Array(totalSize);
  const dataView = new DataView(buffer.buffer);

  // Write command length (Little Endian)
  dataView.setInt32(0, commandLength, true);

  // Write command bytes
  buffer.set(commandBytes, 4);

  // Write message ID
  buffer.set(messageIdBytes, 4 + commandLength);

  return buffer;
}

/**
 * Deserializes a response from binary format
 * Format: [exit: int32] [out_len: int32] [out_bytes] [err_len: int32] [err_bytes] [msg_id: 16 bytes]
 * All integers are Little Endian
 */
export function deserializeResponse(buffer: ArrayBuffer | Uint8Array): CommandResponse {
  // Ensure we're working with a DataView
  const dataView = new DataView(buffer instanceof Uint8Array ? buffer.buffer : buffer);
  // Also keep Uint8Array for byte slicing if needed, but DataView is good for typed reads.
  // Note: if buffer.buffer is used, make sure offset is correct if it's a slice.
  // It's safer to create a Uint8Array view of the passed buffer first to handle potential offsets.
  const uint8Buffer = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);

  // We need to access the underlying ArrayBuffer but respecting the byteOffset of the Uint8Array
  const view = new DataView(uint8Buffer.buffer, uint8Buffer.byteOffset, uint8Buffer.byteLength);

  let offset = 0;

  // Exit Code (int32)
  const exitCode = view.getInt32(offset, true);
  offset += 4;

  // Output Length (int32)
  const outputLength = view.getInt32(offset, true);
  offset += 4;

  // Output Bytes
  const decoder = new TextDecoder('utf-8');
  const outputBytes = uint8Buffer.subarray(offset, offset + outputLength);
  const output = decoder.decode(outputBytes);
  offset += outputLength;

  // Error Length (int32)
  const errorLength = view.getInt32(offset, true);
  offset += 4;

  // Error Bytes
  const errorBytes = uint8Buffer.subarray(offset, offset + errorLength);
  const error = decoder.decode(errorBytes);
  offset += errorLength;

  // Message ID (16 bytes)
  const messageIdBytes = uint8Buffer.subarray(offset, offset + 16);
  const messageId = bytesToUuid(messageIdBytes);

  return {
    exitCode,
    output,
    error,
    messageId,
  };
}
