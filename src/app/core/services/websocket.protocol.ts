/**
 * Binary Protocol Utilities for CtfDeck - with Streaming Support
 */

/**
 * Message types matching the backend
 */
export enum MessageType {
  CompleteResponse = 0,
  StreamOutput = 1,
  StreamError = 2,
  StreamEnd = 3,
}

export interface CommandResponse {
  type: MessageType.CompleteResponse;
  exitCode: number;
  commandOutput: string;
  output: string;
  error: string;
  workingDirectory: string;
  messageId: string;
}

export interface StreamChunk {
  type: MessageType.StreamOutput | MessageType.StreamError;
  messageId: string;
  data: string;
  isError: boolean;
}

export interface StreamEnd {
  type: MessageType.StreamEnd;
  messageId: string;
  exitCode: number;
  workingDirectory: string;
}

export type StreamMessage = CommandResponse | StreamChunk | StreamEnd;

export function uuidToBytes(uuid: string): Uint8Array {
  const hex = uuid.replace(/-/g, '');
  if (hex.length !== 32) throw new Error('Invalid UUID');

  const b = new Uint8Array(16);

  b[0] = parseInt(hex.slice(6, 8), 16);
  b[1] = parseInt(hex.slice(4, 6), 16);
  b[2] = parseInt(hex.slice(2, 4), 16);
  b[3] = parseInt(hex.slice(0, 2), 16);

  b[4] = parseInt(hex.slice(10, 12), 16);
  b[5] = parseInt(hex.slice(8, 10), 16);

  b[6] = parseInt(hex.slice(14, 16), 16);
  b[7] = parseInt(hex.slice(12, 14), 16);

  for (let i = 0; i < 8; i++) {
    b[8 + i] = parseInt(hex.slice(16 + i * 2, 18 + i * 2), 16);
  }

  return b;
}

export function bytesToUuid(bytes: Uint8Array): string {
  const h = (n: number) => n.toString(16).padStart(2, '0');
  return (
    h(bytes[3]) +
    h(bytes[2]) +
    h(bytes[1]) +
    h(bytes[0]) +
    '-' +
    h(bytes[5]) +
    h(bytes[4]) +
    '-' +
    h(bytes[7]) +
    h(bytes[6]) +
    '-' +
    h(bytes[8]) +
    h(bytes[9]) +
    '-' +
    [...bytes.slice(10)].map(h).join('')
  );
}

export function generateUUID(): string {
  return crypto.randomUUID();
}

export function serializeCommand(command: string, messageId: string): Uint8Array {
  const enc = new TextEncoder();
  const cmd = enc.encode(command);
  const id = uuidToBytes(messageId);

  const buf = new Uint8Array(4 + cmd.length + 16);
  const view = new DataView(buf.buffer);

  view.setInt32(0, cmd.length, true);
  buf.set(cmd, 4);
  buf.set(id, 4 + cmd.length);

  return buf;
}

/**
 * Deserialize a streaming message from the server.
 * Returns the appropriate message type based on the first byte.
 */
export function deserializeMessage(data: ArrayBuffer | Uint8Array): StreamMessage {
  const u8 = data instanceof Uint8Array ? data : new Uint8Array(data);
  const v = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const dec = new TextDecoder();

  // First byte is message type
  const messageType = u8[0] as MessageType;

  switch (messageType) {
    case MessageType.CompleteResponse:
      return deserializeCompleteResponse(u8, v, dec);
    case MessageType.StreamOutput:
    case MessageType.StreamError:
      return deserializeStreamChunk(u8, v, dec, messageType);
    case MessageType.StreamEnd:
      return deserializeStreamEnd(u8, v, dec);
    default:
      throw new Error(`Unknown message type: ${messageType}`);
  }
}

function deserializeCompleteResponse(
  u8: Uint8Array,
  v: DataView,
  dec: TextDecoder,
): CommandResponse {
  let o = 1; // Skip message type byte

  const exitCode = v.getInt32(o, true);
  o += 4;

  const readString = () => {
    const len = v.getInt32(o, true);
    o += 4;
    const str = dec.decode(u8.slice(o, o + len));
    o += len;
    return str;
  };

  const commandOutput = readString();
  const error = readString();
  const workingDirectory = readString();

  const messageId = bytesToUuid(u8.slice(o, o + 16));

  return {
    type: MessageType.CompleteResponse,
    exitCode,
    commandOutput,
    output: commandOutput,
    error,
    workingDirectory,
    messageId,
  };
}

function deserializeStreamChunk(
  u8: Uint8Array,
  v: DataView,
  dec: TextDecoder,
  type: MessageType.StreamOutput | MessageType.StreamError,
): StreamChunk {
  let o = 1; // Skip message type byte

  const messageId = bytesToUuid(u8.slice(o, o + 16));
  o += 16;

  const dataLength = v.getInt32(o, true);
  o += 4;

  const data = dec.decode(u8.slice(o, o + dataLength));

  return {
    type,
    messageId,
    data,
    isError: type === MessageType.StreamError,
  };
}

function deserializeStreamEnd(u8: Uint8Array, v: DataView, dec: TextDecoder): StreamEnd {
  let o = 1; // Skip message type byte

  const messageId = bytesToUuid(u8.slice(o, o + 16));
  o += 16;

  const exitCode = v.getInt32(o, true);
  o += 4;

  const wdLength = v.getInt32(o, true);
  o += 4;

  const workingDirectory = dec.decode(u8.slice(o, o + wdLength));

  return {
    type: MessageType.StreamEnd,
    messageId,
    exitCode,
    workingDirectory,
  };
}

// Legacy function for backward compatibility
export function deserializeResponse(data: ArrayBuffer | Uint8Array): CommandResponse {
  const message = deserializeMessage(data);
  if (message.type === MessageType.CompleteResponse) {
    return message;
  }
  throw new Error('Expected CompleteResponse but got: ' + message.type);
}
