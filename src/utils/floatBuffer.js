/** Float32Array ⇄ Buffer helper для хранения эмбеддингов */

export const arrToBuf = arr => {
  const buf = Buffer.allocUnsafe(arr.length * 4);
  arr.forEach((v, i) => buf.writeFloatLE(v, i * 4));
  return buf;
};

export const bufToArr = buf => {
  const len = buf.length / 4;
  const out = new Float32Array(len);
  for (let i = 0; i < len; i++)
    out[i] = buf.readFloatLE(i * 4);
  return Array.from(out);
};
