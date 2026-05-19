import { MessageType } from '../../../infrastructure/transport/websocket/websocket-message-type.enum';
import type { Script } from '../models/script.model';
import {
  BinaryReader,
  BinaryWriter,
  binarySizeOfString,
  deserializeMessageIdError,
  deserializeMessageIdSuccess,
  deserializeMessageIdSuccessUuid,
} from '../../../infrastructure/transport/websocket/websocket-protocol.utils';

export function isCustomScriptResponse(type: number): boolean {
  return (
    type === MessageType.CustomScriptCreateResult ||
    type === MessageType.CustomScriptUpdateResult ||
    type === MessageType.CustomScriptDeleteResult ||
    type === MessageType.CustomScriptListResult ||
    type === MessageType.CustomScriptOperationError
  );
}

export function serializeCustomScriptCreate(
  name: string,
  category: number,
  template: string,
  messageId: string,
): Uint8Array {
  return new BinaryWriter(1 + 16 + binarySizeOfString(name) + 4 + binarySizeOfString(template))
    .writeByte(MessageType.CustomScriptCreate)
    .writeUuid(messageId)
    .writeString(name)
    .writeInt32(category)
    .writeString(template).buffer;
}

export function serializeCustomScriptUpdate(
  scriptId: string,
  name: string,
  category: number,
  template: string,
  messageId: string,
): Uint8Array {
  return new BinaryWriter(1 + 16 + 16 + binarySizeOfString(name) + 4 + binarySizeOfString(template))
    .writeByte(MessageType.CustomScriptUpdate)
    .writeUuid(messageId)
    .writeUuid(scriptId)
    .writeString(name)
    .writeInt32(category)
    .writeString(template).buffer;
}

export function serializeCustomScriptDelete(scriptId: string, messageId: string): Uint8Array {
  return new BinaryWriter(1 + 16 + 16)
    .writeByte(MessageType.CustomScriptDelete)
    .writeUuid(messageId)
    .writeUuid(scriptId).buffer;
}

export function serializeCustomScriptList(messageId: string): Uint8Array {
  return new BinaryWriter(1 + 16).writeByte(MessageType.CustomScriptList).writeUuid(messageId)
    .buffer;
}

export function deserializeCustomScriptCreateResult(data: Uint8Array): {
  messageId: string;
  success: boolean;
  scriptId: string;
} {
  const { messageId, success, entityId: scriptId } = deserializeMessageIdSuccessUuid(data);
  return { messageId, success, scriptId };
}

export function deserializeCustomScriptUpdateResult(data: Uint8Array): {
  messageId: string;
  success: boolean;
} {
  return deserializeMessageIdSuccess(data);
}

export function deserializeCustomScriptDeleteResult(data: Uint8Array): {
  messageId: string;
  success: boolean;
} {
  return deserializeMessageIdSuccess(data);
}

export function deserializeCustomScriptListResult(data: Uint8Array): {
  messageId: string;
  scripts: Script[];
} {
  const reader = new BinaryReader(data, 1);
  const messageId = reader.readUuid();
  const count = reader.readInt32();
  const scripts: Script[] = [];

  for (let i = 0; i < count; i++) {
    const id = reader.readUuid();
    const name = reader.readString();
    const category = reader.readInt32();
    const template = reader.readString();
    scripts.push({ id, name, category, template });
  }

  return { messageId, scripts };
}

export function deserializeCustomScriptOperationError(data: Uint8Array): {
  messageId: string;
  error: string;
} {
  return deserializeMessageIdError(data);
}
