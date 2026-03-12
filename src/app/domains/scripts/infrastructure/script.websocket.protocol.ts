import { MessageType } from '../../../infrastructure/transport/websocket/websocket-message-type.enum';
import {
  bytesToUuid,
  uuidToBytes,
} from '../../../infrastructure/transport/websocket/websocket-uuid.utils';
import type { Script } from '../models/script.model';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

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
  const nameBytes = encoder.encode(name);
  const templateBytes = encoder.encode(template);

  const buffer = new Uint8Array(
    1 + 16 + 4 + nameBytes.length + 4 + 4 + templateBytes.length,
  );
  const view = new DataView(buffer.buffer);

  let offset = 0;

  buffer[offset] = MessageType.CustomScriptCreate;
  offset += 1;

  buffer.set(uuidToBytes(messageId), offset);
  offset += 16;

  view.setInt32(offset, nameBytes.length, true);
  offset += 4;
  buffer.set(nameBytes, offset);
  offset += nameBytes.length;

  view.setInt32(offset, category, true);
  offset += 4;

  view.setInt32(offset, templateBytes.length, true);
  offset += 4;
  buffer.set(templateBytes, offset);

  return buffer;
}

export function serializeCustomScriptUpdate(
  scriptId: string,
  name: string,
  category: number,
  template: string,
  messageId: string,
): Uint8Array {
  const nameBytes = encoder.encode(name);
  const templateBytes = encoder.encode(template);

  const buffer = new Uint8Array(
    1 + 16 + 16 + 4 + nameBytes.length + 4 + 4 + templateBytes.length,
  );
  const view = new DataView(buffer.buffer);

  let offset = 0;

  buffer[offset] = MessageType.CustomScriptUpdate;
  offset += 1;

  buffer.set(uuidToBytes(messageId), offset);
  offset += 16;

  buffer.set(uuidToBytes(scriptId), offset);
  offset += 16;

  view.setInt32(offset, nameBytes.length, true);
  offset += 4;
  buffer.set(nameBytes, offset);
  offset += nameBytes.length;

  view.setInt32(offset, category, true);
  offset += 4;

  view.setInt32(offset, templateBytes.length, true);
  offset += 4;
  buffer.set(templateBytes, offset);

  return buffer;
}

export function serializeCustomScriptDelete(
  scriptId: string,
  messageId: string,
): Uint8Array {
  const buffer = new Uint8Array(1 + 16 + 16);

  buffer[0] = MessageType.CustomScriptDelete;
  buffer.set(uuidToBytes(messageId), 1);
  buffer.set(uuidToBytes(scriptId), 17);

  return buffer;
}

export function serializeCustomScriptList(messageId: string): Uint8Array {
  const buffer = new Uint8Array(1 + 16);

  buffer[0] = MessageType.CustomScriptList;
  buffer.set(uuidToBytes(messageId), 1);

  return buffer;
}

export function deserializeCustomScriptCreateResult(data: Uint8Array): {
  messageId: string;
  success: boolean;
  scriptId: string;
} {
  const messageId = bytesToUuid(data.subarray(1, 17));
  const success = data[17] === 1;
  const scriptId = bytesToUuid(data.subarray(18, 34));

  return { messageId, success, scriptId };
}

export function deserializeCustomScriptUpdateResult(data: Uint8Array): {
  messageId: string;
  success: boolean;
} {
  const messageId = bytesToUuid(data.subarray(1, 17));
  const success = data[17] === 1;

  return { messageId, success };
}

export function deserializeCustomScriptDeleteResult(data: Uint8Array): {
  messageId: string;
  success: boolean;
} {
  const messageId = bytesToUuid(data.subarray(1, 17));
  const success = data[17] === 1;

  return { messageId, success };
}

export function deserializeCustomScriptListResult(data: Uint8Array): {
  messageId: string;
  scripts: Script[];
} {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

  let offset = 0;

  offset += 1;
  const messageId = bytesToUuid(data.subarray(offset, offset + 16));
  offset += 16;

  const count = view.getInt32(offset, true);
  offset += 4;

  const scripts: Script[] = [];

  for (let i = 0; i < count; i++) {
    const scriptId = bytesToUuid(data.subarray(offset, offset + 16));
    offset += 16;

    const nameLength = view.getInt32(offset, true);
    offset += 4;
    const name = decoder.decode(data.subarray(offset, offset + nameLength));
    offset += nameLength;

    const category = view.getInt32(offset, true);
    offset += 4;

    const templateLength = view.getInt32(offset, true);
    offset += 4;
    const template = decoder.decode(data.subarray(offset, offset + templateLength));
    offset += templateLength;

    scripts.push({
      id: scriptId,
      name,
      category,
      template,
    });
  }

  return { messageId, scripts };
}

export function deserializeCustomScriptOperationError(data: Uint8Array): {
  messageId: string;
  error: string;
} {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

  const messageId = bytesToUuid(data.subarray(1, 17));
  const errorLength = view.getInt32(17, true);
  const error = decoder.decode(data.subarray(21, 21 + errorLength));

  return { messageId, error };
}
