function record(type: number, dtype: number, data = Buffer.alloc(0)) {
  if (data.length % 2) data = Buffer.concat([data, Buffer.alloc(1)]);
  const header = Buffer.alloc(4); header.writeUInt16BE(data.length + 4); header[2] = type; header[3] = dtype;
  return Buffer.concat([header, data]);
}
function shorts(...values: number[]) { const data = Buffer.alloc(values.length * 2); values.forEach((v, i) => data.writeUInt16BE(v, i * 2)); return data; }
function xy(...values: number[]) { const data = Buffer.alloc(values.length * 4); values.forEach((v, i) => data.writeInt32BE(v, i * 4)); return record(16, 3, data); }
function real(value: number) {
  let exponent = 64; while (value >= 1) { value /= 16; exponent++; } while (value < 1 / 16) { value *= 16; exponent--; }
  const data = Buffer.alloc(8); data[0] = exponent; let fraction = BigInt(Math.round(value * 2 ** 56));
  for (let i = 7; i >= 1; i--) { data[i] = Number(fraction & 255n); fraction >>= 8n; } return data;
}
export function metadataFixture(textOnly = false) {
  return Buffer.concat([
    record(0, 2, shorts(600)), record(1, 2, Buffer.alloc(24)), record(2, 6, Buffer.from("SYNTHETIC_LIBRARY")), record(3, 5, Buffer.concat([real(0.001), real(1e-9)])),
    record(5, 2, Buffer.alloc(24)), record(6, 6, Buffer.from("SYNTHETIC_CELL")),
    ...(textOnly ? [] : [record(8, 0), record(13, 2, shorts(7)), record(14, 2, shorts(3)), xy(0, 0, 10000, 0, 10000, 10000, 0, 10000, 0, 0), record(43, 2, shorts(9)), record(44, 6, Buffer.from("synthetic property")), record(17, 0)]),
    record(12, 0), record(13, 2, shorts(7)), record(22, 2, shorts(4)), record(23, 1, shorts(5)), record(25, 6, Buffer.from("<img src=x onerror=alert(1)> PIN_A")), xy(1000, 2000), record(28, 5, real(90)), record(17, 0),
    record(0x2A, 2, shorts(1)), record(7, 0), record(4, 0),
  ]);
}
