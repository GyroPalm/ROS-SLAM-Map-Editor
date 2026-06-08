window.SlamMapEditor = window.SlamMapEditor || {};

(function(S) {
  S.parsePGM = function(uint8) {
    var textHead = new TextDecoder().decode(uint8.slice(0, 1024));
    var magic = textHead.slice(0, 2);
    if (magic !== 'P5' && magic !== 'P2') throw new Error('Unsupported PGM magic');

    function* tokens(bytes) {
      var s = '';
      for (var i = 0; i < bytes.length; i++) {
        var c = String.fromCharCode(bytes[i]);
        if (c === '#') { while (i < bytes.length && String.fromCharCode(bytes[i]) !== '\n') i++; continue; }
        if (/\s/.test(c)) { if (s.length) { yield s; s = ''; } } else s += c;
        if (s.length > 256) throw new Error('Header token too long');
      }
      if (s.length) yield s;
    }

    var it = tokens(uint8);
    var mg = it.next().value;
    if (mg !== magic) throw new Error('Malformed header');
    var w = parseInt(it.next().value, 10);
    var h = parseInt(it.next().value, 10);
    var maxv = parseInt(it.next().value, 10);
    if (!(w > 0 && h > 0 && maxv > 0)) throw new Error('Invalid pgm dims/maxval');

    if (magic === 'P2') {
      var restTxt = new TextDecoder().decode(uint8);
      var headerRe = new RegExp('^\\s*' + magic + '[\\s\\S]*?\\b' + maxv + '\\b');
      var headerMatch = restTxt.match(headerRe);
      var start = headerMatch ? headerMatch[0].length : 0;
      var nums = restTxt.slice(start).match(/\d+/g) || [];
      if (nums.length < w * h) throw new Error('P2 data too short');
      var pixels = new Uint16Array(w * h);
      for (var i = 0; i < w * h; i++) pixels[i] = Math.min(maxv, parseInt(nums[i], 10));
      return { magic: magic, width: w, height: h, maxval: maxv, pixels: pixels };
    } else {
      var numCount = 0, idx = 2, inTok = false;
      while (idx < uint8.length && numCount < 3) {
        var c = uint8[idx];
        if (c === 35) { while (idx < uint8.length && uint8[idx] !== 10) idx++; }
        else if (c > 32) { if (!inTok) { inTok = true; numCount++; } }
        else { if (inTok) { inTok = false; } }
        idx++;
      }
      while (idx < uint8.length && uint8[idx] <= 32) idx++;
      var dataStart = idx;

      var pixels = (maxv > 255) ? new Uint16Array(w * h) : new Uint8Array(w * h);
      var bytesPer = (maxv > 255) ? 2 : 1;
      var needed = w * h * bytesPer;
      if (dataStart + needed > uint8.length) throw new Error('P5 data too short');
      if (bytesPer === 1) { pixels.set(uint8.slice(dataStart, dataStart + needed)); }
      else {
        var p = 0;
        for (var k = 0; k < needed; k += 2) { pixels[p++] = (uint8[dataStart + k] << 8) | uint8[dataStart + k + 1]; }
      }
      return { magic: magic, width: w, height: h, maxval: maxv, pixels: pixels };
    }
  };

  S.encodePGM = function(pgm) {
    var w = pgm.width, h = pgm.height, maxval = pgm.maxval, pixels = pgm.pixels;
    var header = 'P5\n' + w + ' ' + h + '\n' + maxval + '\n';
    var enc = new TextEncoder();
    var hbytes = enc.encode(header);
    var bytesPer = (maxval > 255) ? 2 : 1;
    var body = new Uint8Array(w * h * bytesPer);
    if (bytesPer === 1) {
      for (var i = 0; i < w * h; i++) body[i] = Math.min(255, pixels[i]);
    } else {
      var j = 0;
      for (var i = 0; i < w * h; i++) { var v = pixels[i]; body[j++] = (v >> 8) & 0xFF; body[j++] = v & 0xFF; }
    }
    var out = new Uint8Array(hbytes.length + body.length);
    out.set(hbytes, 0);
    out.set(body, hbytes.length);
    return out;
  };
})(window.SlamMapEditor);
