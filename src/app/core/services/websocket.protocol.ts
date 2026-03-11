export enum MessageType {
  CompleteResponse = 0,
  StreamOutput = 1,
  StreamError = 2,
  StreamEnd = 3,
  CommandKill = 4,
  CommandKillResult = 5,
  CommandExecute = 6,
  PasswordRequest = 7,
  PasswordProvide = 8,
  SessionCreate = 10,
  SessionSetActive = 11,
  SessionLoad = 12,
  SessionList = 13,
  SessionDelete = 14,
  SessionUpdateTargets = 15,
  SessionUpdate = 16,
  SessionAddTarget = 17,
  SessionDeleteTarget = 18,
  SessionEditTarget = 19,
  SessionCreateResult = 20,
  SessionSetActiveResult = 21,
  SessionLoadResult = 22,
  SessionListResult = 23,
  SessionDeleteResult = 24,
  SessionUpdateResult = 25,
  SessionAddTargetResult = 26,
  SessionDeleteTargetResult = 27,
  SessionEditTargetResult = 28,
  SessionOperationError = 29,
  CustomScriptCreate = 30,
  CustomScriptUpdate = 31,
  CustomScriptDelete = 32,
  CustomScriptList = 33,
  CustomScriptCreateResult = 40,
  CustomScriptUpdateResult = 41,
  CustomScriptDeleteResult = 42,
  CustomScriptListResult = 43,
  CustomScriptOperationError = 49,
  ToolInventoryRequest = 120,
  ToolInventoryResult = 121,
  ToolInstallRequest = 122,
  ToolInstallAccepted = 123,
  ToolInstallProgress = 124,
  ToolOperationError = 125,
  ToolCatalogSnapshot = 126,

  // WriteUp requests (client -> server)
  WriteUpCreate = 50,
  WriteUpUpdate = 51,
  WriteUpDelete = 52,
  WriteUpList = 53,
  WriteUpLoad = 54,
  WriteUpMove = 55,

  // WriteUp responses (server -> client)
  WriteUpCreateResult = 60,
  WriteUpUpdateResult = 61,
  WriteUpDeleteResult = 62,
  WriteUpListResult = 63,
  WriteUpLoadResult = 64,
  WriteUpMoveResult = 65,
  WriteUpOperationError = 69,

  // Media requests (client -> server)
  MediaUpload = 70,
  MediaLoad = 71,
  MediaDelete = 72,
  MediaList = 73,

  // Media responses (server -> client)
  MediaUploadResult = 80,
  MediaLoadResult = 81,
  MediaDeleteResult = 82,
  MediaListResult = 83,
  MediaOperationError = 89,

  // Project requests (client -> server)
  ProjectCreate = 90,
  ProjectLoad = 91,
  ProjectList = 92,
  ProjectUpdate = 93,
  ProjectDelete = 94,
  ProjectAddFolder = 95,
  ProjectDeleteFolder = 96,
  ProjectRenameFolder = 97,
  ProjectAssignSession = 98,

  // Project responses (server -> client)
  ProjectCreateResult = 100,
  ProjectLoadResult = 101,
  ProjectListResult = 102,
  ProjectUpdateResult = 103,
  ProjectDeleteResult = 104,
  ProjectAddFolderResult = 105,
  ProjectDeleteFolderResult = 106,
  ProjectRenameFolderResult = 107,
  ProjectAssignSessionResult = 108,
  ProjectOperationError = 109,

  // Project content queries (client -> server)
  ProjectListSessions = 110,
  ProjectListSessionsResult = 111,
  ProjectListWriteUps = 112,
  ProjectListWriteUpsResult = 113,
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

export interface ToolCatalogSnapshot {
  type: MessageType.ToolCatalogSnapshot;
  tools: ToolCatalogItem[];
}

export interface ToolCatalogItem {
  id: string;
  displayName: string;
  category: string;
  kind: 'binary' | 'externalWebApp';
  description: string;
  commandTemplate: string | null;
  externalUrl: string | null;
  isInstalled: boolean;
  isInstallable: boolean;
  installedPath: string | null;
  version: string | null;
  reason: string | null;
}

export function deserializeToolCatalogSnapshot(
  data: ArrayBuffer | Uint8Array,
): ToolCatalogSnapshot {
  const u8 = data instanceof Uint8Array ? data : new Uint8Array(data);
  const v = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const dec = new TextDecoder();

  let offset = 0;
  const type = v.getUint8(offset) as MessageType;
  offset += 1;

  if (type !== MessageType.ToolCatalogSnapshot) {
    throw new Error(`Expected ToolCatalogSnapshot but got ${type}`);
  }

  const count = v.getInt32(offset, true);
  offset += 4;

  const readString = () => {
    const len = v.getInt32(offset, true);
    offset += 4;
    const str = dec.decode(u8.slice(offset, offset + len));
    offset += len;
    return str;
  };

  const readNullableString = () => {
    const hasValue = v.getUint8(offset) === 1;
    offset += 1;
    return hasValue ? readString() : null;
  };

  const tools: ToolCatalogItem[] = [];

  for (let i = 0; i < count; i++) {
    const id = readString();
    const displayName = readString();
    const category = readString();
    const kind = readString() as 'binary' | 'externalWebApp';
    const description = readString();
    const commandTemplate = readNullableString();
    const externalUrl = readString() || null;
    const isInstalled = v.getUint8(offset) === 1;
    offset += 1;
    const isInstallable = v.getUint8(offset) === 1;
    offset += 1;
    const installedPath = readString() || null;
    const version = readString() || null;
    const reason = readString() || null;

    tools.push({
      id,
      displayName,
      category,
      kind,
      description,
      commandTemplate,
      externalUrl,
      isInstalled,
      isInstallable,
      installedPath,
      version,
      reason,
    });
  }

  return {
    type: MessageType.ToolCatalogSnapshot,
    tools,
  };
}

export type StreamMessage = CommandResponse | StreamChunk | StreamEnd | PasswordRequest;

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

  const buf = new Uint8Array(1 + 4 + cmd.length + 16);
  const view = new DataView(buf.buffer);

  view.setUint8(0, MessageType.CommandExecute);
  view.setInt32(1, cmd.length, true);
  buf.set(cmd, 5);
  buf.set(id, 5 + cmd.length);

  return buf;
}

export function serializePasswordProvide(messageId: string, password: string): Uint8Array {
  const enc = new TextEncoder();
  const pwd = enc.encode(password);
  const id = uuidToBytes(messageId);

  const buf = new Uint8Array(1 + 16 + 4 + pwd.length);
  const view = new DataView(buf.buffer);

  view.setUint8(0, MessageType.PasswordProvide);
  buf.set(id, 1);
  view.setInt32(17, pwd.length, true);
  buf.set(pwd, 21);

  return buf;
}

export function deserializeMessage(data: ArrayBuffer | Uint8Array): StreamMessage {
  const u8 = data instanceof Uint8Array ? data : new Uint8Array(data);
  const v = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const dec = new TextDecoder();

  const messageType = u8[0] as MessageType;

  switch (messageType) {
    case MessageType.CompleteResponse:
      return deserializeCompleteResponse(u8, v, dec);
    case MessageType.StreamOutput:
    case MessageType.StreamError:
      return deserializeStreamChunk(u8, v, dec, messageType);
    case MessageType.StreamEnd:
      return deserializeStreamEnd(u8, v, dec);
    case MessageType.PasswordRequest:
      return deserializePasswordRequest(u8, v, dec);
    default:
      throw new Error(`Unknown message type: ${messageType}`);
  }
}

function deserializeCompleteResponse(
  u8: Uint8Array,
  v: DataView,
  dec: TextDecoder,
): CommandResponse {
  let o = 1;

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
  let o = 1;

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
  let o = 1;

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

function deserializePasswordRequest(
  u8: Uint8Array,
  v: DataView,
  dec: TextDecoder,
): PasswordRequest {
  let o = 1;

  const messageId = bytesToUuid(u8.slice(o, o + 16));
  o += 16;

  const promptLen = v.getInt32(o, true);
  o += 4;

  const prompt = dec.decode(u8.slice(o, o + promptLen));

  return {
    type: MessageType.PasswordRequest,
    messageId,
    prompt,
  };
}

export function deserializeResponse(data: ArrayBuffer | Uint8Array): CommandResponse {
  const message = deserializeMessage(data);
  if (message.type === MessageType.CompleteResponse) return message;
  throw new Error('Expected CompleteResponse but got: ' + message.type);
}

export interface ToolStatus {
  id: string;
  displayName: string;
  description: string;
  kind: 'binary' | 'externalWebApp';
  isInstalled: boolean;
  isInstallable: boolean;
  installedPath: string | null;
  version: string | null;
  reason: string | null;
}

export enum ToolInstallState {
  Pending = 0,
  Downloading = 1,
  Extracting = 2,
  Installing = 3,
  Verifying = 4,
  Success = 5,
  Failed = 6,
}

export interface ToolInstallAccepted {
  type: MessageType.ToolInstallAccepted;
  messageId: string;
  success: boolean;
}

export interface ToolInventoryResult {
  type: MessageType.ToolInventoryResult;
  messageId: string;
  tools: ToolStatus[];
}

export interface ToolInstallProgress {
  type: MessageType.ToolInstallProgress;
  messageId: string;
  toolId: string;
  state: ToolInstallState;
  message: string | null;
  progressPercent: number | null;
  installedPath: string | null;
  error: string | null;
}

export interface ToolOperationError {
  type: MessageType.ToolOperationError;
  messageId: string;
  error: string;
}

export function serializeToolInventoryRequest(messageId: string): Uint8Array {
  const id = uuidToBytes(messageId);
  const buf = new Uint8Array(1 + 16);

  buf[0] = MessageType.ToolInventoryRequest;
  buf.set(id, 1);

  return buf;
}

export function serializeToolInstallRequest(toolIds: string[], messageId: string): Uint8Array {
  const encoder = new TextEncoder();
  const id = uuidToBytes(messageId);

  const encodedToolIds = toolIds.map((toolId) => encoder.encode(toolId));
  const totalToolIdsSize = encodedToolIds.reduce((sum, bytes) => sum + 4 + bytes.length, 0);

  const buf = new Uint8Array(1 + 16 + 4 + totalToolIdsSize);
  const view = new DataView(buf.buffer);

  let offset = 0;
  view.setUint8(offset, MessageType.ToolInstallRequest);
  offset += 1;

  buf.set(id, offset);
  offset += 16;

  view.setInt32(offset, toolIds.length, true);
  offset += 4;

  for (const bytes of encodedToolIds) {
    view.setInt32(offset, bytes.length, true);
    offset += 4;

    buf.set(bytes, offset);
    offset += bytes.length;
  }

  return buf;
}

export function deserializeToolInventoryResult(
  data: ArrayBuffer | Uint8Array,
): ToolInventoryResult {
  const u8 = data instanceof Uint8Array ? data : new Uint8Array(data);
  const v = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const dec = new TextDecoder();

  let offset = 0;
  const type = v.getUint8(offset) as MessageType;
  offset += 1;

  if (type !== MessageType.ToolInventoryResult) {
    throw new Error(`Expected ToolInventoryResult but got ${type}`);
  }

  const messageId = bytesToUuid(u8.slice(offset, offset + 16));
  offset += 16;

  const count = v.getInt32(offset, true);
  offset += 4;

  const readString = () => {
    const len = v.getInt32(offset, true);
    offset += 4;
    const str = dec.decode(u8.slice(offset, offset + len));
    offset += len;
    return str;
  };

  const tools: ToolStatus[] = [];

  for (let i = 0; i < count; i++) {
    const id = readString();
    const displayName = readString();
    const description = readString();
    const kind = readString() as 'binary' | 'externalWebApp';
    const isInstalled = v.getUint8(offset) === 1;
    offset += 1;
    const isInstallable = v.getUint8(offset) === 1;
    offset += 1;
    const installedPath = readString() || null;
    const version = readString() || null;
    const reason = readString() || null;

    tools.push({
      id,
      displayName,
      description,
      kind,
      isInstalled,
      isInstallable,
      installedPath,
      version,
      reason,
    });
  }

  return {
    type: MessageType.ToolInventoryResult,
    messageId,
    tools,
  };
}

export function deserializeToolInstallAccepted(
  data: ArrayBuffer | Uint8Array,
): ToolInstallAccepted {
  const u8 = data instanceof Uint8Array ? data : new Uint8Array(data);
  const v = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);

  let offset = 0;
  const type = v.getUint8(offset) as MessageType;
  offset += 1;

  if (type !== MessageType.ToolInstallAccepted) {
    throw new Error(`Expected ToolInstallAccepted but got ${type}`);
  }

  const messageId = bytesToUuid(u8.slice(offset, offset + 16));
  offset += 16;

  const success = v.getUint8(offset) === 1;

  return {
    type: MessageType.ToolInstallAccepted,
    messageId,
    success,
  };
}

export function deserializeToolInstallProgress(
  data: ArrayBuffer | Uint8Array,
): ToolInstallProgress {
  const u8 = data instanceof Uint8Array ? data : new Uint8Array(data);
  const v = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const dec = new TextDecoder();

  let offset = 0;
  const type = v.getUint8(offset) as MessageType;
  offset += 1;

  if (type !== MessageType.ToolInstallProgress) {
    throw new Error(`Expected ToolInstallProgress but got ${type}`);
  }

  const messageId = bytesToUuid(u8.slice(offset, offset + 16));
  offset += 16;

  const readString = () => {
    const len = v.getInt32(offset, true);
    offset += 4;
    const str = dec.decode(u8.slice(offset, offset + len));
    offset += len;
    return str;
  };

  const toolId = readString();
  const state = v.getInt32(offset, true) as ToolInstallState;
  offset += 4;
  const message = readString() || null;

  const hasProgress = v.getUint8(offset) === 1;
  offset += 1;

  const progressPercent = hasProgress ? v.getFloat64(offset, true) : null;
  if (hasProgress) {
    offset += 8;
  }

  const installedPath = readString() || null;
  const error = readString() || null;

  return {
    type: MessageType.ToolInstallProgress,
    messageId,
    toolId,
    state,
    message,
    progressPercent,
    installedPath,
    error,
  };
}

export function deserializeToolOperationError(data: ArrayBuffer | Uint8Array): ToolOperationError {
  const u8 = data instanceof Uint8Array ? data : new Uint8Array(data);
  const v = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const dec = new TextDecoder();

  let offset = 0;
  const type = v.getUint8(offset) as MessageType;
  offset += 1;

  if (type !== MessageType.ToolOperationError) {
    throw new Error(`Expected ToolOperationError but got ${type}`);
  }

  const messageId = bytesToUuid(u8.slice(offset, offset + 16));
  offset += 16;

  const errorLen = v.getInt32(offset, true);
  offset += 4;

  const error = dec.decode(u8.slice(offset, offset + errorLen));

  return {
    type: MessageType.ToolOperationError,
    messageId,
    error,
  };
}
