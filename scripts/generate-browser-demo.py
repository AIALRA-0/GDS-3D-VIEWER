"""Generate original synthetic GDS geometry; no private chip design is included."""
import math
import struct
from pathlib import Path

def record(kind, dtype, data=b''):
    if len(data) % 2:
        data += b'\0'
    return struct.pack('>HBB', len(data) + 4, kind, dtype) + data

def real8(value):
    exponent = 64
    while value >= 1:
        value /= 16
        exponent += 1
    while value < 1 / 16:
        value *= 16
        exponent -= 1
    return bytes([exponent]) + int(value * 2**56).to_bytes(7, 'big')

def xy(points):
    return record(16, 3, b''.join(struct.pack('>ii', x, y) for x, y in points))

def rect(layer, x, y, w, h, datatype=0):
    return record(8, 0) + record(13, 2, struct.pack('>h', layer)) + record(14, 2, struct.pack('>h', datatype)) + xy([(x,y),(x+w,y),(x+w,y+h),(x,y+h),(x,y)]) + record(17, 0)

def begin(name):
    return record(5, 2, bytes(24)) + record(6, 6, name.encode('ascii'))

def reference(name, x, y, angle=0, reflect=False):
    result=record(10, 0) + record(18, 6, name.encode())
    if reflect:
        result += record(26, 1, struct.pack('>H', 0x8000))
    if angle:
        result += record(28, 5, real8(angle))
    return result + xy([(x,y)]) + record(17, 0)

data = record(0, 2, struct.pack('>h', 600)) + record(1, 2, bytes(24)) + record(2, 6, b'AIALRA_SYNTHETIC') + record(3, 5, real8(0.001) + real8(1e-9))
data += begin('logic_tile')
for row in range(5):
    for col in range(7):
        x,y=col*2500,row*3500
        data += rect(65,x,y,1500,2500)
        data += rect(66,x+600,y-300,300,3100)
        data += rect(67,x+300,y+400,800,400)
        data += rect(68,x,y+1100,2000,280)
data += record(7, 0) + begin('routing_tile')
for i in range(20):
    data += rect(69,i*2200,0,600,48000)
    data += rect(70,0,i*2400,46000,500)
    for j in range(20):
        data += rect(71,i*2200+100,j*2400+100,400,300)
data += record(7, 0) + begin('AIALRA_DEMO')
data += rect(64,-5000,-5000,230000,190000)
for row in range(8):
    for col in range(10):
        data += reference('logic_tile',col*22000,row*21000)
for row in range(3):
    for col in range(4):
        data += reference('routing_tile',col*53000,row*58000)
for i in range(30):
    data += rect(72,-3000,i*6000,226000,600)
    data += rect(73,i*7500,-3000,500,186000)
data += record(7, 0) + record(4, 0)
target=Path(__file__).resolve().parents[1]/'apps/web/public-static/samples/demo.gds'
target.parent.mkdir(parents=True,exist_ok=True)
target.write_bytes(data)
print(f'Generated synthetic demo: {len(data)} bytes')
