const count = 1000000;
const src = new Float32Array(16);
for(let i=0; i<16; i++) src[i] = i;
const dst = new Float32Array(count * 16);

// Warm up
for(let i=0; i<10000; i++) {
    const offset = i * 16;
    dst.set(src, offset);
}

console.time('manual');
for(let i=0; i<count; i++) {
    const offset = i * 16;
    dst[offset] = src[0];
    dst[offset+1] = src[1];
    dst[offset+2] = src[2];
    dst[offset+3] = src[3];
    dst[offset+4] = src[4];
    dst[offset+5] = src[5];
    dst[offset+6] = src[6];
    dst[offset+7] = src[7];
    dst[offset+8] = src[8];
    dst[offset+9] = src[9];
    dst[offset+10] = src[10];
    dst[offset+11] = src[11];
    dst[offset+12] = src[12];
    dst[offset+13] = src[13];
    dst[offset+14] = src[14];
    dst[offset+15] = src[15];
}
console.timeEnd('manual');

console.time('set');
for(let i=0; i<count; i++) {
    const offset = i * 16;
    dst.set(src, offset);
}
console.timeEnd('set');
