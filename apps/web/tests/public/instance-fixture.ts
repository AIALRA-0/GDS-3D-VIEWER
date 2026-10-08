function record(type: number, dtype: number, data = Buffer.alloc(0)) {
  if (data.length % 2) data = Buffer.concat([data, Buffer.alloc(1)]);
  const h = Buffer.alloc(4); h.writeUInt16BE(data.length + 4); h[2] = type; h[3] = dtype; return Buffer.concat([h, data]);
}
function short(...values: number[]) { const b = Buffer.alloc(values.length * 2); values.forEach((v,i) => b.writeUInt16BE(v,i*2)); return b; }
function xy(...values: number[]) { const b = Buffer.alloc(values.length * 4); values.forEach((v,i) => b.writeInt32BE(v,i*4)); return record(16,3,b); }
function real(v: number) { let e=64; while(v>=1) {v/=16;e++;} while(v<1/16) {v*=16;e--;} const b=Buffer.alloc(8);b[0]=e;let m=BigInt(Math.round(v*2**56));for(let i=7;i>=1;i--){b[i]=Number(m&255n);m>>=8n;}return b; }
function cell(name: string) { return Buffer.concat([record(5,2,Buffer.alloc(24)),record(6,6,Buffer.from(name))]); }
export const TILE = "TILE/with:marker";
function polygon(layer: number, x=0, y=0) { return Buffer.concat([record(8,0),record(13,2,short(layer)),record(14,2,short(0)),xy(x,y,x+10,y,x+10,y+10,x,y+10,x,y),record(17,0)]); }
export function instanceFixture(columns=2, rows=2, copies=1) {
  return Buffer.concat([record(0,2,short(600)),record(1,2,Buffer.alloc(24)),record(2,6,Buffer.from("SYNTHETIC")),record(3,5,Buffer.concat([real(1),real(1e-6)])),
    cell(TILE),...Array.from({length:copies},()=>polygon(7)),record(7,0),
    cell("MIDDLE"),record(10,0),record(18,6,Buffer.from(TILE)),record(28,5,real(90)),xy(10,0),record(17,0),record(7,0),
    cell("TOP"),polygon(8,columns*20+40,rows*20+40),
    record(10,0),record(18,6,Buffer.from(TILE)),xy(columns*20+20,0),record(17,0),
    record(11,0),record(18,6,Buffer.from("MIDDLE")),record(19,2,short(columns,rows)),xy(0,0,columns*20,0,0,rows*20),record(17,0),
    record(10,0),record(18,6,Buffer.from(TILE)),record(26,1,short(0x8000)),record(27,5,real(2)),record(28,5,real(90)),xy(0,rows*20+20),record(17,0),record(7,0),
    cell("OTHER_TOP"),polygon(9),record(7,0),record(4,0)]);
}
