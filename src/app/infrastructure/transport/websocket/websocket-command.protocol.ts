import { MessageType } from './websocket-message-type.enum';
import { bytesToUuid, uuidToBytes } from './websocket-uuid.utils';

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

export interface PasswordRequest {
  type: MessageType.PasswordRequest;
  messageId: string;
  prompt: string;
}

export type StreamMessage =
  | CommandResponse
  | StreamChunk
  | StreamEnd
  | PasswordRequest;

export function serializeCommand(command: string, messageId: string): Uint8Array {
  const encoder = new TextEncoder();
  const commandBytes = encoder.encode(command);
  const idBytes = uuidToBytes(messageId);

  const buffer = new Uint8Array(1 + 4 + commandBytes.length + 16);
  const view = new DataView(buffer.buffer);

  view.setUint8(0, MessageType.CommandExecute);
  view.setInt32(1, commandBytes.length, true);
  buffer.set(commandBytes, 5);
  buffer.set(idBytes, 5 + commandBytes.length);

  return buffer;
}

export function serializePasswordProvide(messageId: string, password: string): Uint8Array {
  const encoder = new TextEncoder();
  const passwordBytes = encoder.encode(password);
  const idBytes = uuidToBytes(messageId);

  const buffer = new Uint8Array(1 + 16 + 4 + passwordBytes.length);
  const view = new DataView(buffer.buffer);

  view.setUint8(0, MessageType.PasswordProvide);
  buffer.set(idBytes, 1);
  view.setInt32(17, passwordBytes.length, true);
  buffer.set(passwordBytes, 21);

  return buffer;
}

export function deserializeMessage(data: ArrayBuffer | Uint8Array): StreamMessage {
  const u8 = data instanceof Uint8Array ? data : new Uint8Array(data);
  const view = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const decoder = new TextDecoder();

  const messageType = u8[0] as MessageType;

  switch (messageType) {
    case MessageType.CompleteResponse:
      return deserializeCompleteResponse(u8, view, decoder);
    case MessageType.StreamOutput:
    case MessageType.StreamError:
      return deserializeStreamChunk(u8, view, decoder, messageType);
    case MessageType.StreamEnd:
      return deserializeStreamEnd(u8, view, decoder);
    case MessageType.PasswordRequest:
      return deserializePasswordRequest(u8, view, decoder);
    default:
      throw new Error(`Unknown message type: ${messageType}`);
  }
}

export function deserializeResponse(data: ArrayBuffer | Uint8Array): CommandResponse {
  const message = deserializeMessage(data);

  if (message.type === MessageType.CompleteResponse) {
    return message;
  }

  throw new Error(`Expected CompleteResponse but got: ${message.type}`);
}

function deserializeCompleteResponse(
  u8: Uint8Array,
  view: DataView,
  decoder: TextDecoder,
): CommandResponse {
  let offset = 1;

  const exitCode = view.getInt32(offset, true);
  offset += 4;

  const readString = () => {
    const length = view.getInt32(offset, true);
    offset += 4;
    const value = decoder.decode(u8.slice(offset, offset + length));
    offset += length;
    return value;
  };

  const commandOutput = readString();
  const error = readString();
  const workingDirectory = readString();
  const messageId = bytesToUuid(u8.slice(offset, offset + 16));

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
  view: DataView,
  decoder: TextDecoder,
  type: MessageType.StreamOutput | MessageType.StreamError,
): StreamChunk {
  let offset = 1;

  const messageId = bytesToUuid(u8.slice(offset, offset + 16));
  offset += 16;

  const dataLength = view.getInt32(offset, true);
  offset += 4;

  const data = decoder.decode(u8.slice(offset, offset + dataLength));

  return {
    type,
    messageId,
    data,
    isError: type === MessageType.StreamError,
  };
}

function deserializeStreamEnd(
  u8: Uint8Array,
  view: DataView,
  decoder: TextDecoder,
): StreamEnd {
  let offset = 1;

  const messageId = bytesToUuid(u8.slice(offset, offset + 16));
  offset += 16;

  const exitCode = view.getInt32(offset, true);
  offset += 4;

  const workingDirectoryLength = view.getInt32(offset, true);
  offset += 4;

  const workingDirectory = decoder.decode(
    u8.slice(offset, offset + workingDirectoryLength),
  );

  return {
    type: MessageType.StreamEnd,
    messageId,
    exitCode,
    workingDirectory,
  };
}

function deserializePasswordRequest(
  u8: Uint8Array,
  view: DataView,
  decoder: TextDecoder,
): PasswordRequest {
  let offset = 1;

  const messageId = bytesToUuid(u8.slice(offset, offset + 16));
  offset += 16;

  const promptLength = view.getInt32(offset, true);
  offset += 4;

  const prompt = decoder.decode(u8.slice(offset, offset + promptLength));

  return {
    type: MessageType.PasswordRequest,
    messageId,
    prompt,
  };
}
