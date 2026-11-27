// A small GIF decoder, so the montage can play GIFs as GIFs.
//
// Why this exists: browsers turn a GIF into a single still picture when you
// decode it the normal way (createImageBitmap), so the montage used to show
// only its first frame. Chrome has a built-in frame-by-frame decoder
// (ImageDecoder), but Safari on iPhone doesn't, so this reads the file itself.
//
// decodeGif(arrayBuffer) -> { width, height, frames: [{ bitmap, delay }], duration }
//   bitmap   the full picture for that frame (already layered on the frames
//            before it, the way a browser shows the GIF)
//   delay    how long that frame stays on screen, in milliseconds
//   duration all the delays added up: one play-through at normal (1x) speed
//
// GIF in one paragraph: a header, an optional colour table, then a list of
// blocks. An "extension" block before each picture says how long to show it
// and what to do with it afterwards (its "disposal"). Each picture's pixels
// are squeezed with LZW compression (a dictionary of repeated runs).

(function () {
  // Browsers show any delay under 20ms as 100ms; we copy that, so a GIF
  // plays here at the same speed it plays everywhere else.
  const MIN_DELAY = 20;
  const DEFAULT_DELAY = 100;

  function isGif(bytes) {
    // every GIF starts with the letters "GIF8"
    return bytes.length > 6 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38;
  }

  // LZW decompression: turns a picture's compressed bytes into one colour
  // index per pixel.
  function lzw(minCodeSize, data, pixelCount) {
    const out = new Uint8Array(pixelCount);
    const clear = 1 << minCodeSize;
    const end = clear + 1;
    let codeSize = minCodeSize + 1;
    let nextCode = end + 1;
    // the dictionary: each code = (previous code, last byte, length)
    const prefix = new Int32Array(4096);
    const suffix = new Uint8Array(4096);
    const length = new Int32Array(4096);
    for (let i = 0; i < clear; i++) { prefix[i] = -1; suffix[i] = i; length[i] = 1; }
    let prev = -1;
    let o = 0;
    let bits = 0;
    let bitCount = 0;
    let p = 0;
    const stack = new Uint8Array(4096);
    while (o < pixelCount) {
      while (bitCount < codeSize) {
        if (p >= data.length) return out;
        bits |= data[p++] << bitCount;
        bitCount += 8;
      }
      const code = bits & ((1 << codeSize) - 1);
      bits >>= codeSize;
      bitCount -= codeSize;
      if (code === clear) { codeSize = minCodeSize + 1; nextCode = end + 1; prev = -1; continue; }
      if (code === end) break;
      let cur = code;
      let first;
      if (code >= nextCode) {          // the one tricky case: code not made yet
        cur = prev;
      }
      // unwind the code into bytes (they come out backwards)
      let n = 0;
      let c = cur;
      while (c >= 0 && n < 4096) { stack[n++] = suffix[c]; c = prefix[c]; }
      first = stack[n - 1];
      for (let k = n - 1; k >= 0 && o < pixelCount; k--) out[o++] = stack[k];
      if (code >= nextCode && o < pixelCount) out[o++] = first;
      if (prev >= 0 && nextCode < 4096) {
        prefix[nextCode] = prev;
        suffix[nextCode] = first;
        length[nextCode] = length[prev] + 1;
        nextCode++;
        if (nextCode === (1 << codeSize) && codeSize < 12) codeSize++;
      }
      prev = code;
    }
    return out;
  }

  function readColorTable(bytes, at, size) {
    const table = new Uint8Array(size * 3);
    table.set(bytes.subarray(at, at + size * 3));
    return table;
  }

  async function decodeGif(buffer) {
    const bytes = new Uint8Array(buffer);
    if (!isGif(bytes)) throw new Error('not a GIF');
    const width = bytes[6] | (bytes[7] << 8);
    const height = bytes[8] | (bytes[9] << 8);
    const packed = bytes[10];
    let p = 13;
    let globalTable = null;
    if (packed & 0x80) {
      const size = 1 << ((packed & 7) + 1);
      globalTable = readColorTable(bytes, p, size);
      p += size * 3;
    }

    // the picture as it looks on screen, built up frame by frame
    const screen = new ImageData(width, height);
    let saved = null;          // for "restore to previous" disposal
    const frames = [];
    let delay = DEFAULT_DELAY;
    let transparent = -1;
    let disposal = 0;

    while (p < bytes.length) {
      const block = bytes[p++];
      if (block === 0x3B) break;                       // end of file
      if (block === 0x21) {                            // an extension
        const label = bytes[p++];
        if (label === 0xF9) {                          // graphic control: delay, transparency, disposal
          const flags = bytes[p + 1];
          disposal = (flags >> 2) & 7;
          const cs = bytes[p + 2] | (bytes[p + 3] << 8);
          delay = cs * 10 < MIN_DELAY ? DEFAULT_DELAY : cs * 10;
          transparent = flags & 1 ? bytes[p + 4] : -1;
        }
        // skip the extension's data sub-blocks
        while (p < bytes.length && bytes[p] !== 0) p += bytes[p] + 1;
        p++;
        continue;
      }
      if (block !== 0x2C) break;                       // not a picture: stop

      // a picture (one frame)
      const fx = bytes[p] | (bytes[p + 1] << 8);
      const fy = bytes[p + 2] | (bytes[p + 3] << 8);
      const fw = bytes[p + 4] | (bytes[p + 5] << 8);
      const fh = bytes[p + 6] | (bytes[p + 7] << 8);
      const fpacked = bytes[p + 8];
      p += 9;
      let table = globalTable;
      if (fpacked & 0x80) {
        const size = 1 << ((fpacked & 7) + 1);
        table = readColorTable(bytes, p, size);
        p += size * 3;
      }
      const interlaced = Boolean(fpacked & 0x40);
      const minCodeSize = bytes[p++];
      // gather the compressed data, which comes in chunks of up to 255 bytes
      const chunks = [];
      let total = 0;
      while (p < bytes.length && bytes[p] !== 0) {
        const n = bytes[p];
        chunks.push(bytes.subarray(p + 1, p + 1 + n));
        total += n;
        p += n + 1;
      }
      p++;
      const data = new Uint8Array(total);
      let off = 0;
      for (const c of chunks) { data.set(c, off); off += c.length; }
      const indices = lzw(minCodeSize, data, fw * fh);

      if (disposal === 3) saved = new Uint8ClampedArray(screen.data);

      // interlaced GIFs store their rows in four passes
      const rowOrder = [];
      if (interlaced) {
        for (const [start, step] of [[0, 8], [4, 8], [2, 4], [1, 2]]) {
          for (let r = start; r < fh; r += step) rowOrder.push(r);
        }
      }
      // paint this frame's pixels onto the screen
      for (let i = 0; i < fh; i++) {
        const row = interlaced ? rowOrder[i] : i;
        const y = fy + row;
        if (y >= height) continue;
        for (let x = 0; x < fw; x++) {
          const sx = fx + x;
          if (sx >= width) continue;
          const ci = indices[i * fw + x];
          if (ci === transparent || !table) continue;
          const d = (y * width + sx) * 4;
          screen.data[d] = table[ci * 3];
          screen.data[d + 1] = table[ci * 3 + 1];
          screen.data[d + 2] = table[ci * 3 + 2];
          screen.data[d + 3] = 255;
        }
      }

      frames.push({ bitmap: await createImageBitmap(screen), delay });

      // what to do with this frame before the next one
      if (disposal === 2) {                            // clear its area
        for (let y = fy; y < Math.min(fy + fh, height); y++) {
          for (let x = fx; x < Math.min(fx + fw, width); x++) {
            const d = (y * width + x) * 4;
            screen.data[d] = screen.data[d + 1] = screen.data[d + 2] = screen.data[d + 3] = 0;
          }
        }
      } else if (disposal === 3 && saved) {            // put back what was there
        screen.data.set(saved);
      }
      // the next frame starts with fresh settings
      delay = DEFAULT_DELAY; transparent = -1; disposal = 0;
    }

    if (!frames.length) throw new Error('GIF has no frames');
    const duration = frames.reduce((t, f) => t + f.delay, 0);
    return { width, height, frames, duration };
  }

  window.BruhGif = { decodeGif, isGif };
})();
