/**
 * Binary Protocol Utilities for CtfDeck
 */

export interface CommandResponse {
  exitCode: number;
  commandOutput: string;
  output: string;
  error: string;
  messageId: string;
}

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

export function deserializeResponse(data: ArrayBuffer | Uint8Array): CommandResponse {
  const u8 = data instanceof Uint8Array ? data : new Uint8Array(data);
  const v = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const dec = new TextDecoder();

  let o = 0;

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

  const messageId = bytesToUuid(u8.slice(o, o + 16));

  return {
    exitCode,
    commandOutput,
    output: commandOutput,
    error,
    messageId,
  };
}
