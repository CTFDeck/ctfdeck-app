import { bytesToUuid, uuidToBytes } from './websocket-uuid.utils';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export const NULL_UUID = '00000000-0000-0000-0000-000000000000';

export function toUint8Array(data: ArrayBuffer | Uint8Array): Uint8Array {
  return data instanceof ArrayBuffer ? new Uint8Array(data) : data;
}

export function ticksToDate(ticks: bigint): Date {
  const epochDiff = BigInt('621355968000000000');
  const ticksPerMs = BigInt(10000);
  return new Date(Number((ticks - epochDiff) / ticksPerMs));
}

export function makeDataView(data: Uint8Array): DataView {
  return new DataView(data.buffer, data.byteOffset, data.byteLength);
}

export function binarySizeOfString(str: string): number {
  return 4 + encoder.encode(str).length;
}

export function binarySizeOfStrings(...strings: string[]): number {
  return strings.reduce((sum, s) => sum + binarySizeOfString(s), 0);
}

export class BinaryWriter {
  readonly buffer: Uint8Array;
  readonly view: DataView;
  private offset = 0;

  constructor(size: number) {
    this.buffer = new Uint8Array(size);
    this.view = new DataView(this.buffer.buffer);
  }

  writeByte(value: number): this {
    this.buffer[this.offset++] = value;
    return this;
  }

  writeUuid(uuid: string): this {
    this.buffer.set(uuidToBytes(uuid), this.offset);
    this.offset += 16;
    return this;
  }

  writeNullableUuid(uuid: string | null): this {
    return this.writeUuid(uuid ?? NULL_UUID);
  }

  writeBoolean(value: boolean): this {
    this.buffer[this.offset++] = value ? 1 : 0;
    return this;
  }

  writeInt32(value: number): this {
    this.view.setInt32(this.offset, value, true);
    this.offset += 4;
    return this;
  }

  writeString(str: string): this {
    const bytes = encoder.encode(str);
    this.view.setInt32(this.offset, bytes.length, true);
    this.offset += 4;
    this.buffer.set(bytes, this.offset);
    this.offset += bytes.length;
    return this;
  }

  writeBytes(bytes: Uint8Array): this {
    this.view.setInt32(this.offset, bytes.length, true);
    this.offset += 4;
    this.buffer.set(bytes, this.offset);
    this.offset += bytes.length;
    return this;
  }
}

export class BinaryReader {
  private offset: number;
  readonly view: DataView;

  constructor(
    private readonly data: Uint8Array,
    startOffset = 0,
  ) {
    this.offset = startOffset;
    this.view = makeDataView(data);
  }

  get currentOffset(): number {
    return this.offset;
  }

  readByte(): number {
    return this.data[this.offset++];
  }

  readUuid(): string {
    const uuid = bytesToUuid(this.data.subarray(this.offset, this.offset + 16));
    this.offset += 16;
    return uuid;
  }

  readNullableUuid(): string | null {
    const raw = this.readUuid();
    return raw === NULL_UUID ? null : raw;
  }

  readBoolean(): boolean {
    return this.data[this.offset++] === 1;
  }

  readInt32(): number {
    const value = this.view.getInt32(this.offset, true);
    this.offset += 4;
    return value;
  }

  readBigInt64(): bigint {
    const value = this.view.getBigInt64(this.offset, true);
    this.offset += 8;
    return value;
  }

  readString(): string {
    const length = this.readInt32();
    const value = decoder.decode(this.data.subarray(this.offset, this.offset + length));
    this.offset += length;
    return value;
  }

  readNullableString(): string | null {
    const hasValue = this.readBoolean();
    return hasValue ? this.readString() : null;
  }

  readStringOrNull(): string | null {
    const value = this.readString();
    return value || null;
  }
}

export function deserializeMessageIdSuccess(data: Uint8Array): {
  messageId: string;
  success: boolean;
} {
  const reader = new BinaryReader(data, 1);
  return { messageId: reader.readUuid(), success: reader.readBoolean() };
}

export function deserializeMessageIdSuccessUuid(data: Uint8Array): {
  messageId: string;
  success: boolean;
  entityId: string;
} {
  const reader = new BinaryReader(data, 1);
  const messageId = reader.readUuid();
  const success = reader.readBoolean();
  const entityId = reader.readUuid();
  return { messageId, success, entityId };
}

export function deserializeMessageIdError(data: Uint8Array): {
  messageId: string;
  error: string;
} {
  const reader = new BinaryReader(data, 1);
  const messageId = reader.readUuid();
  const error = reader.readString();
  return { messageId, error };
}

export function beginSuccessPayloadReader(data: Uint8Array): {
  reader: BinaryReader;
  messageId: string;
  success: boolean;
} {
  const reader = new BinaryReader(data, 1);
  const messageId = reader.readUuid();
  const success = reader.readBoolean();
  return { reader, messageId, success };
}
