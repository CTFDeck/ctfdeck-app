// websocket-command.protocol.ts
import { MessageType } from './websocket-message-type.enum';
import { bytesToUuid, uuidToBytes } from './websocket-uuid.utils';
import { BinaryReader, toUint8Array } from './websocket-protocol.utils';
 
export enum CommandSignalKind {
  Interrupt = 0,
  Eof = 1,
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

export interface PasswordRequest {
  type: MessageType.PasswordRequest;
  messageId: string;
  prompt: string;
}

export type StreamMessage = CommandResponse | StreamChunk | StreamEnd | PasswordRequest;

export function serializeCommand(command: string, messageId: string): Uint8Array {
  const encoder = new TextEncoder();
  const commandBytes = encoder.encode(command);
  const buffer = new Uint8Array(1 + 4 + commandBytes.length + 16);
  const view = new DataView(buffer.buffer);
  view.setUint8(0, MessageType.CommandExecute);
  view.setInt32(1, commandBytes.length, true);
  buffer.set(commandBytes, 5);
  buffer.set(uuidToBytes(messageId), 5 + commandBytes.length);
  return buffer;
}

export function serializePasswordProvide(messageId: string, password: string): Uint8Array {
  const encoder = new TextEncoder();
  const passwordBytes = encoder.encode(password);
  const buffer = new Uint8Array(1 + 16 + 4 + passwordBytes.length);
  const view = new DataView(buffer.buffer);
  view.setUint8(0, MessageType.PasswordProvide);
  buffer.set(uuidToBytes(messageId), 1);
  view.setInt32(17, passwordBytes.length, true);
  buffer.set(passwordBytes, 21);
  return buffer;
}

export function serializeCommandSignal(messageId: string, kind: CommandSignalKind): Uint8Array {
  const buffer = new Uint8Array(1 + 16 + 1);
  const view = new DataView(buffer.buffer);
  view.setUint8(0, MessageType.CommandSignal);
  buffer.set(uuidToBytes(messageId), 1);
  view.setUint8(17, kind);
  return buffer;
}

export function serializeCommandKill(messageId: string): Uint8Array {
  const buffer = new Uint8Array(1 + 16);
  const view = new DataView(buffer.buffer);
  view.setUint8(0, MessageType.CommandKill);
  buffer.set(uuidToBytes(messageId), 1);
  return buffer;
}

export function serializeCommandInput(messageId: string, input: string): Uint8Array {
  const encoder = new TextEncoder();
  const inputBytes = encoder.encode(input);
  const buffer = new Uint8Array(1 + 16 + 4 + inputBytes.length);
  const view = new DataView(buffer.buffer);
  view.setUint8(0, MessageType.CommandInput);
  buffer.set(uuidToBytes(messageId), 1);
  view.setUint32(17, inputBytes.length, true);
  buffer.set(inputBytes, 21);
  return buffer;
}

export function deserializeMessage(data: ArrayBuffer | Uint8Array): StreamMessage {
  const u8 = toUint8Array(data);
  const messageType = u8[0] as MessageType;

  switch (messageType) {
    case MessageType.CompleteResponse:
      return deserializeCompleteResponse(u8);
    case MessageType.StreamOutput:
    case MessageType.StreamError:
      return deserializeStreamChunk(u8, messageType);
    case MessageType.StreamEnd:
      return deserializeStreamEnd(u8);
    case MessageType.PasswordRequest:
      return deserializePasswordRequest(u8);
    default:
      throw new Error(`Unknown message type: ${messageType}`);
  }
}

function deserializeCompleteResponse(u8: Uint8Array): CommandResponse {
  const reader = new BinaryReader(u8, 1);
  const exitCode = reader.readInt32();
  const commandOutput = reader.readString();
  const error = reader.readString();
  const workingDirectory = reader.readString();
  const messageId = bytesToUuid(u8.slice(reader.currentOffset, reader.currentOffset + 16));

  return { type: MessageType.CompleteResponse, exitCode, commandOutput, output: commandOutput, error, workingDirectory, messageId };
}

function deserializeStreamChunk(u8: Uint8Array, type: MessageType.StreamOutput | MessageType.StreamError): StreamChunk {
  const reader = new BinaryReader(u8, 1);
  const messageId = reader.readUuid();
  const data = reader.readString();
  return { type, messageId, data, isError: type === MessageType.StreamError };
}

function deserializeStreamEnd(u8: Uint8Array): StreamEnd {
  const reader = new BinaryReader(u8, 1);
  const messageId = reader.readUuid();
  const exitCode = reader.readInt32();
  const workingDirectory = reader.readString();
  return { type: MessageType.StreamEnd, messageId, exitCode, workingDirectory };
}

function deserializePasswordRequest(u8: Uint8Array): PasswordRequest {
  const reader = new BinaryReader(u8, 1);
  const messageId = reader.readUuid();
  const prompt = reader.readString();
  return { type: MessageType.PasswordRequest, messageId, prompt };
}
