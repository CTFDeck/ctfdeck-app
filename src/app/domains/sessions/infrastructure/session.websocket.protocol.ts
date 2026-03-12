import { MessageType } from '../../../infrastructure/transport/websocket/websocket-message-type.enum';
import {
  bytesToUuid,
  uuidToBytes,
} from '../../../infrastructure/transport/websocket/websocket-uuid.utils';
import type { SessionData } from '../models/session-data.model';
import type { SessionHistoryEntry } from '../models/session-history-entry.model';
import type { SessionMetadata } from '../models/session-metadata.model';
import type { SessionTarget } from '../models/session-target.model';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function isSessionResponse(type: number): boolean {
  return type >= MessageType.SessionCreateResult && type <= MessageType.SessionOperationError;
}

export function serializeSessionCreate(name: string, messageId: string): Uint8Array {
  const nameBytes = encoder.encode(name);
  const buffer = new Uint8Array(1 + 16 + 4 + nameBytes.length);
  const view = new DataView(buffer.buffer);

  buffer[0] = MessageType.SessionCreate;
  buffer.set(uuidToBytes(messageId), 1);
  view.setInt32(17, nameBytes.length, true);
  buffer.set(nameBytes, 21);

  return buffer;
}

export function serializeSessionSetActive(sessionId: string, messageId: string): Uint8Array {
  const buffer = new Uint8Array(1 + 16 + 16);
  buffer[0] = MessageType.SessionSetActive;
  buffer.set(uuidToBytes(messageId), 1);
  buffer.set(uuidToBytes(sessionId), 17);
  return buffer;
}

export function serializeSessionLoad(sessionId: string, messageId: string): Uint8Array {
  const buffer = new Uint8Array(1 + 16 + 16);
  buffer[0] = MessageType.SessionLoad;
  buffer.set(uuidToBytes(messageId), 1);
  buffer.set(uuidToBytes(sessionId), 17);
  return buffer;
}

export function serializeSessionList(
  offset: number,
  limit: number,
  messageId: string,
  unassignedOnly = false,
): Uint8Array {
  const buffer = new Uint8Array(1 + 16 + 4 + 4 + 1);
  const view = new DataView(buffer.buffer);

  buffer[0] = MessageType.SessionList;
  buffer.set(uuidToBytes(messageId), 1);
  view.setInt32(17, offset, true);
  view.setInt32(21, limit, true);
  buffer[25] = unassignedOnly ? 1 : 0;

  return buffer;
}

export function serializeSessionDelete(sessionId: string, messageId: string): Uint8Array {
  const buffer = new Uint8Array(1 + 16 + 16);
  buffer[0] = MessageType.SessionDelete;
  buffer.set(uuidToBytes(messageId), 1);
  buffer.set(uuidToBytes(sessionId), 17);
  return buffer;
}

export function serializeSessionUpdateTargets(
  sessionId: string,
  targets: SessionTarget[],
  messageId: string,
): Uint8Array {
  let size = 1 + 16 + 16 + 4;

  for (const target of targets) {
    const addrBytes = encoder.encode(target.address);
    const nameBytes = encoder.encode(target.name);
    const descBytes = encoder.encode(target.description || '');

    size += 16 + 4 + addrBytes.length + 4 + 4 + nameBytes.length + 4 + descBytes.length + 4;
  }

  const buffer = new Uint8Array(size);
  const view = new DataView(buffer.buffer);
  let offset = 0;

  buffer[offset] = MessageType.SessionUpdateTargets;
  offset += 1;

  buffer.set(uuidToBytes(messageId), offset);
  offset += 16;

  buffer.set(uuidToBytes(sessionId), offset);
  offset += 16;

  view.setInt32(offset, targets.length, true);
  offset += 4;

  for (const target of targets) {
    buffer.set(uuidToBytes(target.id), offset);
    offset += 16;

    const addrBytes = encoder.encode(target.address);
    view.setInt32(offset, addrBytes.length, true);
    offset += 4;
    buffer.set(addrBytes, offset);
    offset += addrBytes.length;

    view.setInt32(offset, target.port ?? -1, true);
    offset += 4;

    const nameBytes = encoder.encode(target.name);
    view.setInt32(offset, nameBytes.length, true);
    offset += 4;
    buffer.set(nameBytes, offset);
    offset += nameBytes.length;

    const descBytes = encoder.encode(target.description || '');
    view.setInt32(offset, descBytes.length, true);
    offset += 4;
    buffer.set(descBytes, offset);
    offset += descBytes.length;

    view.setInt32(offset, target.type, true);
    offset += 4;
  }

  return buffer;
}

export function serializeSessionUpdate(
  sessionId: string,
  name: string,
  description: string,
  messageId: string,
): Uint8Array {
  const nameBytes = encoder.encode(name);
  const descBytes = encoder.encode(description);
  const buffer = new Uint8Array(1 + 16 + 16 + 4 + nameBytes.length + 4 + descBytes.length);
  const view = new DataView(buffer.buffer);

  let offset = 0;

  buffer[offset] = MessageType.SessionUpdate;
  offset += 1;

  buffer.set(uuidToBytes(messageId), offset);
  offset += 16;

  buffer.set(uuidToBytes(sessionId), offset);
  offset += 16;

  view.setInt32(offset, nameBytes.length, true);
  offset += 4;
  buffer.set(nameBytes, offset);
  offset += nameBytes.length;

  view.setInt32(offset, descBytes.length, true);
  offset += 4;
  buffer.set(descBytes, offset);

  return buffer;
}

export function serializeSessionAddTarget(
  sessionId: string,
  address: string,
  port: number | null,
  name: string,
  type: number,
  description: string,
  messageId: string,
): Uint8Array {
  const addrBytes = encoder.encode(address);
  const nameBytes = encoder.encode(name);
  const descBytes = encoder.encode(description || '');
  const buffer = new Uint8Array(
    1 + 16 + 16 + 4 + addrBytes.length + 4 + 4 + nameBytes.length + 4 + descBytes.length + 4,
  );
  const view = new DataView(buffer.buffer);

  let offset = 0;

  buffer[offset] = MessageType.SessionAddTarget;
  offset += 1;

  buffer.set(uuidToBytes(messageId), offset);
  offset += 16;

  buffer.set(uuidToBytes(sessionId), offset);
  offset += 16;

  view.setInt32(offset, addrBytes.length, true);
  offset += 4;
  buffer.set(addrBytes, offset);
  offset += addrBytes.length;

  view.setInt32(offset, port ?? -1, true);
  offset += 4;

  view.setInt32(offset, nameBytes.length, true);
  offset += 4;
  buffer.set(nameBytes, offset);
  offset += nameBytes.length;

  view.setInt32(offset, descBytes.length, true);
  offset += 4;
  buffer.set(descBytes, offset);
  offset += descBytes.length;

  view.setInt32(offset, type, true);

  return buffer;
}

export function serializeSessionDeleteTarget(
  sessionId: string,
  targetId: string,
  messageId: string,
): Uint8Array {
  const buffer = new Uint8Array(1 + 16 + 16 + 16);
  buffer[0] = MessageType.SessionDeleteTarget;
  buffer.set(uuidToBytes(messageId), 1);
  buffer.set(uuidToBytes(sessionId), 17);
  buffer.set(uuidToBytes(targetId), 33);
  return buffer;
}

export function serializeSessionEditTarget(
  sessionId: string,
  targetId: string,
  address: string,
  port: number | null,
  name: string,
  type: number,
  description: string,
  messageId: string,
): Uint8Array {
  const addrBytes = encoder.encode(address);
  const nameBytes = encoder.encode(name);
  const descBytes = encoder.encode(description || '');
  const buffer = new Uint8Array(
    1 + 16 + 16 + 16 + 4 + addrBytes.length + 4 + 4 + nameBytes.length + 4 + descBytes.length + 4,
  );
  const view = new DataView(buffer.buffer);

  let offset = 0;

  buffer[offset] = MessageType.SessionEditTarget;
  offset += 1;

  buffer.set(uuidToBytes(messageId), offset);
  offset += 16;

  buffer.set(uuidToBytes(sessionId), offset);
  offset += 16;

  buffer.set(uuidToBytes(targetId), offset);
  offset += 16;

  view.setInt32(offset, addrBytes.length, true);
  offset += 4;
  buffer.set(addrBytes, offset);
  offset += addrBytes.length;

  view.setInt32(offset, port ?? -1, true);
  offset += 4;

  view.setInt32(offset, nameBytes.length, true);
  offset += 4;
  buffer.set(nameBytes, offset);
  offset += nameBytes.length;

  view.setInt32(offset, descBytes.length, true);
  offset += 4;
  buffer.set(descBytes, offset);
  offset += descBytes.length;

  view.setInt32(offset, type, true);

  return buffer;
}

export function deserializeSessionCreateResult(data: Uint8Array): {
  messageId: string;
  success: boolean;
  sessionId: string;
} {
  const messageId = bytesToUuid(data.subarray(1, 17));
  const success = data[17] === 1;
  const sessionId = bytesToUuid(data.subarray(18, 34));

  return { messageId, success, sessionId };
}

export function deserializeSessionSetActiveResult(data: Uint8Array): {
  messageId: string;
  success: boolean;
} {
  const messageId = bytesToUuid(data.subarray(1, 17));
  const success = data[17] === 1;

  return { messageId, success };
}

export function deserializeSessionDeleteResult(data: Uint8Array): {
  messageId: string;
  success: boolean;
} {
  const messageId = bytesToUuid(data.subarray(1, 17));
  const success = data[17] === 1;

  return { messageId, success };
}

export function deserializeSessionUpdateResult(data: Uint8Array): {
  messageId: string;
  success: boolean;
} {
  const messageId = bytesToUuid(data.subarray(1, 17));
  const success = data[17] === 1;

  return { messageId, success };
}

export function deserializeSessionAddTargetResult(data: Uint8Array): {
  messageId: string;
  success: boolean;
  targetId: string;
} {
  const messageId = bytesToUuid(data.subarray(1, 17));
  const success = data[17] === 1;
  const targetId = bytesToUuid(data.subarray(18, 34));

  return { messageId, success, targetId };
}

export function deserializeSessionDeleteTargetResult(data: Uint8Array): {
  messageId: string;
  success: boolean;
} {
  const messageId = bytesToUuid(data.subarray(1, 17));
  const success = data[17] === 1;

  return { messageId, success };
}

export function deserializeSessionEditTargetResult(data: Uint8Array): {
  messageId: string;
  success: boolean;
} {
  const messageId = bytesToUuid(data.subarray(1, 17));
  const success = data[17] === 1;

  return { messageId, success };
}

export function deserializeSessionListResult(data: Uint8Array): {
  messageId: string;
  totalCount: number;
  sessions: SessionMetadata[];
} {
  if (data.byteLength < 25) {
    throw new Error(`SessionListResult too short: ${data.byteLength} bytes`);
  }

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const messageId = bytesToUuid(data.subarray(1, 17));
  const count = view.getInt32(17, true);
  const totalCount = view.getInt32(21, true);

  if (count < 0 || count > 10_000) {
    throw new Error(`SessionListResult invalid count: ${count}`);
  }

  let offset = 25;
  const sessions: SessionMetadata[] = [];

  for (let i = 0; i < count; i++) {
    if (offset + 16 > data.byteLength) {
      throw new Error(`SessionListResult truncated at session ${i} (id)`);
    }

    const id = bytesToUuid(data.subarray(offset, offset + 16));
    offset += 16;

    if (offset + 4 > data.byteLength) {
      throw new Error(`SessionListResult truncated at session ${i} (nameLen)`);
    }

    const nameLen = view.getInt32(offset, true);

    if (nameLen < 0 || offset + 4 + nameLen > data.byteLength) {
      throw new Error(`SessionListResult invalid nameLen=${nameLen} at session ${i}`);
    }

    offset += 4;
    const name = decoder.decode(data.subarray(offset, offset + nameLen));
    offset += nameLen;

    if (offset + 4 > data.byteLength) {
      throw new Error(`SessionListResult truncated at session ${i} (descLen)`);
    }

    const descLen = view.getInt32(offset, true);

    if (descLen < 0 || offset + 4 + descLen > data.byteLength) {
      throw new Error(`SessionListResult invalid descLen=${descLen} at session ${i}`);
    }

    offset += 4;
    const description = decoder.decode(data.subarray(offset, offset + descLen));
    offset += descLen;

    if (offset + 16 > data.byteLength) {
      throw new Error(`SessionListResult truncated at session ${i} (timestamps)`);
    }

    const createdAtTicks = view.getBigInt64(offset, true);
    offset += 8;

    const updatedAtTicks = view.getBigInt64(offset, true);
    offset += 8;

    if (offset + 8 > data.byteLength) {
      throw new Error(`SessionListResult truncated at session ${i} (counts)`);
    }

    const historyCount = view.getInt32(offset, true);
    offset += 4;

    const targetCount = view.getInt32(offset, true);
    offset += 4;

    const projectIdRaw = bytesToUuid(data.subarray(offset, offset + 16));
    const projectId = projectIdRaw === '00000000-0000-0000-0000-000000000000' ? null : projectIdRaw;
    offset += 16;

    const folderIdRaw = bytesToUuid(data.subarray(offset, offset + 16));
    const folderId = folderIdRaw === '00000000-0000-0000-0000-000000000000' ? null : folderIdRaw;
    offset += 16;

    sessions.push({
      id,
      name,
      description,
      projectId,
      folderId,
      createdAt: ticksToDate(createdAtTicks),
      updatedAt: ticksToDate(updatedAtTicks),
      historyCount,
      targetCount,
    });
  }

  return { messageId, totalCount, sessions };
}

export function deserializeSessionLoadResult(data: Uint8Array): {
  messageId: string;
  success: boolean;
  session: SessionData | null;
} {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const messageId = bytesToUuid(data.subarray(1, 17));
  const success = data[17] === 1;

  if (!success) {
    return { messageId, success, session: null };
  }

  let offset = 18;

  const id = bytesToUuid(data.subarray(offset, offset + 16));
  offset += 16;

  const nameLen = view.getInt32(offset, true);
  offset += 4;
  const name = decoder.decode(data.subarray(offset, offset + nameLen));
  offset += nameLen;

  const descLen = view.getInt32(offset, true);
  offset += 4;
  const description = decoder.decode(data.subarray(offset, offset + descLen));
  offset += descLen;

  const createdAtTicks = view.getBigInt64(offset, true);
  offset += 8;

  const updatedAtTicks = view.getBigInt64(offset, true);
  offset += 8;

  const projectIdRaw = bytesToUuid(data.subarray(offset, offset + 16));
  const projectId = projectIdRaw === '00000000-0000-0000-0000-000000000000' ? null : projectIdRaw;
  offset += 16;

  const folderIdRaw = bytesToUuid(data.subarray(offset, offset + 16));
  const folderId = folderIdRaw === '00000000-0000-0000-0000-000000000000' ? null : folderIdRaw;
  offset += 16;

  const historyCount = view.getInt32(offset, true);
  offset += 4;
  const history: SessionHistoryEntry[] = [];

  for (let i = 0; i < historyCount; i++) {
    const entryId = bytesToUuid(data.subarray(offset, offset + 16));
    offset += 16;

    const timestampTicks = view.getBigInt64(offset, true);
    offset += 8;

    const wdLen = view.getInt32(offset, true);
    offset += 4;
    const workingDirectory = decoder.decode(data.subarray(offset, offset + wdLen));
    offset += wdLen;

    const cmdLen = view.getInt32(offset, true);
    offset += 4;
    const command = decoder.decode(data.subarray(offset, offset + cmdLen));
    offset += cmdLen;

    const outLen = view.getInt32(offset, true);
    offset += 4;
    const output = decoder.decode(data.subarray(offset, offset + outLen));
    offset += outLen;

    const exitCode = view.getInt32(offset, true);
    offset += 4;

    history.push({
      id: entryId,
      timestamp: ticksToDate(timestampTicks),
      workingDirectory,
      command,
      output,
      exitCode,
    });
  }

  const targetCount = view.getInt32(offset, true);
  offset += 4;
  const targets: SessionTarget[] = [];

  for (let i = 0; i < targetCount; i++) {
    const targetId = bytesToUuid(data.subarray(offset, offset + 16));
    offset += 16;

    const addrLen = view.getInt32(offset, true);
    offset += 4;
    const address = decoder.decode(data.subarray(offset, offset + addrLen));
    offset += addrLen;

    const port = view.getInt32(offset, true);
    offset += 4;

    const targetNameLen = view.getInt32(offset, true);
    offset += 4;
    const targetName = decoder.decode(data.subarray(offset, offset + targetNameLen));
    offset += targetNameLen;

    const targetDescLen = view.getInt32(offset, true);
    offset += 4;
    const targetDescription = decoder.decode(data.subarray(offset, offset + targetDescLen));
    offset += targetDescLen;

    const type = view.getInt32(offset, true);
    offset += 4;

    targets.push({
      id: targetId,
      address,
      port: port === -1 ? null : port,
      name: targetName,
      description: targetDescription,
      type,
    });
  }

  return {
    messageId,
    success,
    session: {
      id,
      name,
      description,
      projectId,
      folderId,
      createdAt: ticksToDate(createdAtTicks),
      updatedAt: ticksToDate(updatedAtTicks),
      history,
      targets,
    },
  };
}

export function deserializeSessionOperationError(data: Uint8Array): {
  messageId: string;
  error: string;
} {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const messageId = bytesToUuid(data.subarray(1, 17));
  const errLen = view.getInt32(17, true);
  const error = decoder.decode(data.subarray(21, 21 + errLen));

  return { messageId, error };
}

function ticksToDate(ticks: bigint): Date {
  const epochDiff = BigInt('621355968000000000');
  const ticksPerMs = BigInt(10000);
  const ms = Number((ticks - epochDiff) / ticksPerMs);

  return new Date(ms);
}
