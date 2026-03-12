export function uuidToBytes(uuid: string): Uint8Array {
  const hex = uuid.replace(/-/g, '');
  if (hex.length !== 32) {
    throw new Error('Invalid UUID');
  }

  const bytes = new Uint8Array(16);

  bytes[0] = parseInt(hex.slice(6, 8), 16);
  bytes[1] = parseInt(hex.slice(4, 6), 16);
  bytes[2] = parseInt(hex.slice(2, 4), 16);
  bytes[3] = parseInt(hex.slice(0, 2), 16);

  bytes[4] = parseInt(hex.slice(10, 12), 16);
  bytes[5] = parseInt(hex.slice(8, 10), 16);

  bytes[6] = parseInt(hex.slice(14, 16), 16);
  bytes[7] = parseInt(hex.slice(12, 14), 16);

  for (let i = 0; i < 8; i++) {
    bytes[8 + i] = parseInt(hex.slice(16 + i * 2, 18 + i * 2), 16);
  }

  return bytes;
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
