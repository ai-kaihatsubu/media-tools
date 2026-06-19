/* ============================================
   ツール置き場 004-qr-code-generator : qrcode-lib.js
   外部ライブラリ不使用の自己完結QRコードエンコーダ
   - byteモード(UTF-8)対応（必須）
   - numeric/alphanumericモードによるビット長最適化（任意最適化）
   - バージョン1〜40自動選択
   - 誤り訂正レベル L/M/Q/H
   - マスクパターン0〜7から最適なものを自動選択（ペナルティ評価）
   - フォーマット情報・バージョン情報の配置（JIS X 0510 / ISO 18004準拠）
   ============================================ */

(function (global) {
  "use strict";

  /* ---------- ガロア体 GF(256) 演算（QRの誤り訂正で使用） ---------- */
  const GF_EXP = new Array(512);
  const GF_LOG = new Array(256);
  (function initGF() {
    let x = 1;
    for (let i = 0; i < 255; i++) {
      GF_EXP[i] = x;
      GF_LOG[x] = i;
      x <<= 1;
      if (x & 0x100) x ^= 0x11d; // QRコードの原始多項式 x^8 + x^4 + x^3 + x^2 + 1
    }
    for (let i = 255; i < 512; i++) {
      GF_EXP[i] = GF_EXP[i - 255];
    }
  })();

  function gfMul(a, b) {
    if (a === 0 || b === 0) return 0;
    return GF_EXP[GF_LOG[a] + GF_LOG[b]];
  }

  // 多項式の積（係数は次数の高い順の配列）
  function polyMul(p1, p2) {
    const result = new Array(p1.length + p2.length - 1).fill(0);
    for (let i = 0; i < p1.length; i++) {
      for (let j = 0; j < p2.length; j++) {
        result[i + j] ^= gfMul(p1[i], p2[j]);
      }
    }
    return result;
  }

  // 誤り訂正生成多項式 (x - alpha^0)(x - alpha^1)...(x - alpha^(n-1))
  function generatorPoly(degree) {
    let g = [1];
    for (let i = 0; i < degree; i++) {
      g = polyMul(g, [1, GF_EXP[i]]);
    }
    return g;
  }

  // メッセージ多項式を生成多項式で割った余り（誤り訂正コード語）
  function computeECC(data, eccCount) {
    const generator = generatorPoly(eccCount);
    const result = data.slice();
    result.push(...new Array(eccCount).fill(0));
    for (let i = 0; i < data.length; i++) {
      const coef = result[i];
      if (coef === 0) continue;
      for (let j = 0; j < generator.length; j++) {
        result[i + j] ^= gfMul(generator[j], coef);
      }
    }
    return result.slice(data.length);
  }

  /* ---------- 誤り訂正レベル ---------- */
  const EC_LEVELS = { L: 0, M: 1, Q: 2, H: 3 };
  // フォーマット情報に使うEC指示子（規格表 表25）
  const EC_INDICATOR = { L: 1, M: 0, Q: 3, H: 2 };

  /* ---------- バージョンごとの容量・ブロック構成テーブル ----------
     RS_BLOCKS[version][ecLevel] = [ecCodewordsPerBlock, group1Blocks, group1DataCodewords, group2Blocks, group2DataCodewords]
     ISO/IEC 18004 表9 に基づく値。 */
  const RS_BLOCKS = buildRSBlocks();

  function buildRSBlocks() {
    // データは [L, M, Q, H] の順。各エントリ: [ecCodewords, b1count, b1data, b2count, b2data]
    const table = {
      1: [[7, 1, 19, 0, 0], [10, 1, 16, 0, 0], [13, 1, 13, 0, 0], [17, 1, 9, 0, 0]],
      2: [[10, 1, 34, 0, 0], [16, 1, 28, 0, 0], [22, 1, 22, 0, 0], [28, 1, 16, 0, 0]],
      3: [[15, 1, 55, 0, 0], [26, 1, 44, 0, 0], [18, 2, 17, 0, 0], [22, 2, 13, 0, 0]],
      4: [[20, 1, 80, 0, 0], [18, 2, 32, 0, 0], [26, 2, 24, 0, 0], [16, 4, 9, 0, 0]],
      5: [[26, 1, 108, 0, 0], [24, 2, 43, 0, 0], [18, 2, 15, 2, 16], [22, 2, 11, 2, 12]],
      6: [[18, 2, 68, 0, 0], [16, 4, 27, 0, 0], [24, 4, 19, 0, 0], [28, 4, 15, 0, 0]],
      7: [[20, 2, 78, 0, 0], [18, 4, 31, 0, 0], [18, 2, 14, 4, 15], [26, 4, 13, 1, 14]],
      8: [[24, 2, 97, 0, 0], [22, 2, 38, 2, 39], [22, 4, 18, 2, 19], [26, 4, 14, 2, 15]],
      9: [[30, 2, 116, 0, 0], [22, 3, 36, 2, 37], [20, 4, 16, 4, 17], [24, 4, 12, 4, 13]],
      10: [[18, 2, 68, 2, 69], [26, 4, 43, 1, 44], [24, 6, 19, 2, 20], [28, 6, 15, 2, 16]],
      11: [[20, 4, 81, 0, 0], [30, 1, 50, 4, 51], [28, 4, 22, 4, 23], [24, 3, 12, 8, 13]],
      12: [[24, 2, 92, 2, 93], [22, 6, 36, 2, 37], [26, 4, 20, 6, 21], [28, 7, 14, 4, 15]],
      13: [[26, 4, 107, 0, 0], [22, 8, 37, 1, 38], [24, 8, 20, 4, 21], [22, 12, 11, 4, 12]],
      14: [[30, 3, 115, 1, 116], [24, 4, 40, 5, 41], [20, 11, 16, 5, 17], [24, 11, 12, 5, 13]],
      15: [[22, 5, 87, 1, 88], [24, 5, 41, 5, 42], [30, 5, 24, 7, 25], [24, 11, 12, 7, 13]],
      16: [[24, 5, 98, 1, 99], [28, 7, 45, 3, 46], [24, 15, 19, 2, 20], [30, 3, 15, 13, 16]],
      17: [[28, 1, 107, 5, 108], [28, 10, 46, 1, 47], [28, 1, 22, 15, 23], [28, 2, 14, 17, 15]],
      18: [[30, 5, 120, 1, 121], [26, 9, 43, 4, 44], [28, 17, 22, 1, 23], [28, 2, 14, 19, 15]],
      19: [[28, 3, 113, 4, 114], [26, 3, 44, 11, 45], [26, 17, 21, 4, 22], [26, 9, 13, 16, 14]],
      20: [[28, 3, 107, 5, 108], [26, 3, 41, 13, 42], [30, 15, 24, 5, 25], [28, 15, 15, 10, 16]],
      21: [[28, 4, 116, 4, 117], [26, 17, 42, 0, 0], [28, 17, 22, 6, 23], [30, 19, 16, 6, 17]],
      22: [[28, 2, 111, 7, 112], [28, 17, 46, 0, 0], [30, 7, 24, 16, 25], [24, 34, 13, 0, 0]],
      23: [[30, 4, 121, 5, 122], [28, 4, 47, 14, 48], [30, 11, 24, 14, 25], [30, 16, 15, 14, 16]],
      24: [[30, 6, 117, 4, 118], [28, 6, 45, 14, 46], [30, 11, 24, 16, 25], [30, 30, 16, 2, 17]],
      25: [[26, 8, 106, 4, 107], [28, 8, 47, 13, 48], [30, 7, 24, 22, 25], [30, 22, 15, 13, 16]],
      26: [[28, 10, 114, 2, 115], [28, 19, 46, 4, 47], [28, 28, 22, 6, 23], [30, 33, 16, 4, 17]],
      27: [[30, 8, 122, 4, 123], [28, 22, 45, 3, 46], [30, 8, 23, 26, 24], [30, 12, 15, 28, 16]],
      28: [[30, 3, 117, 10, 118], [28, 3, 45, 23, 46], [30, 4, 24, 31, 25], [30, 11, 15, 31, 16]],
      29: [[30, 7, 116, 7, 117], [28, 21, 45, 7, 46], [30, 1, 23, 37, 24], [30, 19, 15, 26, 16]],
      30: [[30, 5, 115, 10, 116], [28, 19, 47, 10, 48], [30, 15, 24, 25, 25], [30, 23, 15, 25, 16]],
      31: [[30, 13, 115, 3, 116], [28, 2, 46, 29, 47], [30, 42, 24, 1, 25], [30, 23, 15, 28, 16]],
      32: [[30, 17, 115, 0, 0], [28, 10, 46, 23, 47], [30, 10, 24, 35, 25], [30, 19, 15, 35, 16]],
      33: [[30, 17, 115, 1, 116], [28, 14, 46, 21, 47], [30, 29, 24, 19, 25], [30, 11, 15, 46, 16]],
      34: [[30, 13, 115, 6, 116], [28, 14, 46, 23, 47], [30, 44, 24, 7, 25], [30, 59, 16, 1, 17]],
      35: [[30, 12, 121, 7, 122], [28, 12, 47, 26, 48], [30, 39, 24, 14, 25], [30, 22, 15, 41, 16]],
      36: [[30, 6, 121, 14, 122], [28, 6, 47, 34, 48], [30, 46, 24, 10, 25], [30, 2, 15, 64, 16]],
      37: [[30, 17, 122, 4, 123], [28, 29, 46, 14, 47], [30, 49, 24, 10, 25], [30, 24, 15, 46, 16]],
      38: [[30, 4, 122, 18, 123], [28, 13, 46, 32, 47], [30, 48, 24, 14, 25], [30, 42, 15, 32, 16]],
      39: [[30, 20, 117, 4, 118], [28, 40, 47, 7, 48], [30, 43, 24, 22, 25], [30, 10, 15, 67, 16]],
      40: [[30, 19, 118, 6, 119], [28, 18, 47, 31, 48], [30, 34, 24, 34, 25], [30, 20, 15, 61, 16]],
    };
    const result = {};
    for (let v = 1; v <= 40; v++) {
      result[v] = {};
      ["L", "M", "Q", "H"].forEach((lvl, idx) => {
        const [ec, b1c, b1d, b2c, b2d] = table[v][idx];
        result[v][lvl] = { ec, b1c, b1d, b2c, b2d };
      });
    }
    return result;
  }

  // 各バージョン・ECレベルにおける総データコードワード数
  function totalDataCodewords(version, ecLevel) {
    const b = RS_BLOCKS[version][ecLevel];
    return b.b1c * b.b1d + b.b2c * b.b2d;
  }

  /* ---------- 文字種判定 ---------- */
  const ALPHANUMERIC_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:";
  function isNumeric(ch) {
    return ch >= "0" && ch <= "9";
  }
  function isAlphanumeric(ch) {
    return ALPHANUMERIC_CHARS.indexOf(ch) !== -1;
  }

  // 入力文字列全体に最適なモードを判定（簡易: 全体がnumericならnumeric、全体がalphanumericならalphanumeric、それ以外はbyte）
  function detectMode(text) {
    if (text.length === 0) return "byte";
    let allNumeric = true;
    let allAlnum = true;
    for (const ch of text) {
      if (!isNumeric(ch)) allNumeric = false;
      if (!isAlphanumeric(ch)) allAlnum = false;
      if (!allNumeric && !allAlnum) break;
    }
    if (allNumeric) return "numeric";
    if (allAlnum) return "alphanumeric";
    return "byte";
  }

  // UTF-8バイト列に変換
  function toUtf8Bytes(text) {
    return Array.from(new TextEncoder().encode(text));
  }

  /* ---------- モード指示子・文字数指示子のビット長 ---------- */
  const MODE_INDICATOR = { numeric: 0b0001, alphanumeric: 0b0010, byte: 0b0100 };

  function charCountBits(mode, version) {
    if (version <= 9) {
      return mode === "numeric" ? 10 : mode === "alphanumeric" ? 9 : 8;
    } else if (version <= 26) {
      return mode === "numeric" ? 12 : mode === "alphanumeric" ? 11 : 16;
    } else {
      return mode === "numeric" ? 14 : mode === "alphanumeric" ? 13 : 16;
    }
  }

  /* ---------- ビットバッファ ---------- */
  class BitBuffer {
    constructor() {
      this.bits = [];
    }
    put(value, length) {
      for (let i = length - 1; i >= 0; i--) {
        this.bits.push((value >>> i) & 1);
      }
    }
    get length() {
      return this.bits.length;
    }
    toBytes() {
      const bytes = [];
      for (let i = 0; i < this.bits.length; i += 8) {
        let b = 0;
        for (let j = 0; j < 8; j++) {
          b = (b << 1) | (this.bits[i + j] || 0);
        }
        bytes.push(b);
      }
      return bytes;
    }
  }

  /* ---------- データのビット長を見積もる（モード指示子+文字数指示子+データ） ---------- */
  function estimateBitLength(mode, dataLength, version) {
    const header = 4 + charCountBits(mode, version);
    let dataBits;
    if (mode === "numeric") {
      dataBits = Math.floor(dataLength / 3) * 10 + (dataLength % 3 === 1 ? 4 : dataLength % 3 === 2 ? 7 : 0);
    } else if (mode === "alphanumeric") {
      dataBits = Math.floor(dataLength / 2) * 11 + (dataLength % 2 === 1 ? 6 : 0);
    } else {
      dataBits = dataLength * 8;
    }
    return header + dataBits;
  }

  // 与えられたmode/データ長に対して、容量に収まる最小バージョンを探す
  function findMinVersion(mode, dataUnitLength, ecLevel) {
    for (let v = 1; v <= 40; v++) {
      const bits = estimateBitLength(mode, dataUnitLength, v);
      const capacityBits = totalDataCodewords(v, ecLevel) * 8;
      if (bits <= capacityBits) return v;
    }
    return null; // 入りきらない
  }

  /* ---------- データセグメントのエンコード ---------- */
  function encodeSegment(buffer, mode, text, version) {
    buffer.put(MODE_INDICATOR[mode], 4);

    if (mode === "numeric") {
      buffer.put(text.length, charCountBits(mode, version));
      for (let i = 0; i < text.length; i += 3) {
        const chunk = text.substr(i, 3);
        const bitLen = chunk.length === 3 ? 10 : chunk.length === 2 ? 7 : 4;
        buffer.put(parseInt(chunk, 10), bitLen);
      }
    } else if (mode === "alphanumeric") {
      buffer.put(text.length, charCountBits(mode, version));
      for (let i = 0; i < text.length; i += 2) {
        if (i + 1 < text.length) {
          const val = ALPHANUMERIC_CHARS.indexOf(text[i]) * 45 + ALPHANUMERIC_CHARS.indexOf(text[i + 1]);
          buffer.put(val, 11);
        } else {
          buffer.put(ALPHANUMERIC_CHARS.indexOf(text[i]), 6);
        }
      }
    } else {
      // byte mode: UTF-8
      const bytes = toUtf8Bytes(text);
      buffer.put(bytes.length, charCountBits(mode, version));
      for (const b of bytes) {
        buffer.put(b, 8);
      }
    }
  }

  /* ---------- データコードワードの構築（終端パターン・パディング） ---------- */
  function buildDataCodewords(text, mode, version, ecLevel) {
    const buffer = new BitBuffer();
    encodeSegment(buffer, mode, text, version);

    const capacityBits = totalDataCodewords(version, ecLevel) * 8;

    // 終端パターン (最大4bit)
    const terminatorLen = Math.min(4, capacityBits - buffer.length);
    if (terminatorLen > 0) buffer.put(0, terminatorLen);

    // 8bit境界までパディング
    while (buffer.length % 8 !== 0) {
      buffer.put(0, 1);
    }

    // パディングコードワード (0xEC, 0x11 を交互に)
    const padBytes = [0xec, 0x11];
    let padIndex = 0;
    while (buffer.length < capacityBits) {
      buffer.put(padBytes[padIndex % 2], 8);
      padIndex++;
    }

    return buffer.toBytes();
  }

  /* ---------- ブロック分割 + 誤り訂正 + インターリーブ ---------- */
  function interleaveWithECC(dataCodewords, version, ecLevel) {
    const rs = RS_BLOCKS[version][ecLevel];
    const blocks = [];
    let offset = 0;

    for (let i = 0; i < rs.b1c; i++) {
      const data = dataCodewords.slice(offset, offset + rs.b1d);
      offset += rs.b1d;
      blocks.push({ data, ecc: computeECC(data, rs.ec) });
    }
    for (let i = 0; i < rs.b2c; i++) {
      const data = dataCodewords.slice(offset, offset + rs.b2d);
      offset += rs.b2d;
      blocks.push({ data, ecc: computeECC(data, rs.ec) });
    }

    const result = [];
    const maxDataLen = Math.max(rs.b1d, rs.b2d);
    for (let i = 0; i < maxDataLen; i++) {
      for (const block of blocks) {
        if (i < block.data.length) result.push(block.data[i]);
      }
    }
    for (let i = 0; i < rs.ec; i++) {
      for (const block of blocks) {
        result.push(block.ecc[i]);
      }
    }
    return result;
  }

  /* ---------- マトリクス生成 ---------- */

  // バージョンに応じたアライメントパターン中心座標
  const ALIGNMENT_POSITIONS = {
    1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34],
    7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50],
    11: [6, 30, 54], 12: [6, 32, 58], 13: [6, 34, 62], 14: [6, 26, 46, 66],
    15: [6, 26, 48, 70], 16: [6, 26, 50, 74], 17: [6, 30, 54, 78],
    18: [6, 30, 56, 82], 19: [6, 30, 58, 86], 20: [6, 34, 62, 90],
    21: [6, 28, 50, 72, 94], 22: [6, 26, 50, 74, 98], 23: [6, 30, 54, 78, 102],
    24: [6, 28, 54, 80, 106], 25: [6, 32, 58, 84, 110], 26: [6, 30, 58, 86, 114],
    27: [6, 34, 62, 90, 118], 28: [6, 26, 50, 74, 98, 122], 29: [6, 30, 54, 78, 102, 126],
    30: [6, 26, 52, 78, 104, 130], 31: [6, 30, 56, 82, 108, 134], 32: [6, 34, 60, 86, 112, 138],
    33: [6, 30, 58, 86, 114, 142], 34: [6, 34, 62, 90, 118, 146], 35: [6, 30, 54, 78, 102, 126, 150],
    36: [6, 24, 50, 76, 102, 128, 154], 37: [6, 28, 54, 80, 106, 132, 158], 38: [6, 32, 58, 84, 110, 136, 162],
    39: [6, 26, 54, 82, 110, 138, 166], 40: [6, 30, 58, 86, 114, 142, 170],
  };

  // バージョン情報のBCH符号（バージョン7以上で使用） v=7..40
  const VERSION_INFO_BITS = {
    7: 0x07c94, 8: 0x085bc, 9: 0x09a99, 10: 0x0a4d3, 11: 0x0bbf6, 12: 0x0c762,
    13: 0x0d847, 14: 0x0e60d, 15: 0x0f928, 16: 0x10b78, 17: 0x1145d, 18: 0x12a17,
    19: 0x13532, 20: 0x149a6, 21: 0x15683, 22: 0x168c9, 23: 0x177ec, 24: 0x18ec4,
    25: 0x191e1, 26: 0x1afab, 27: 0x1b08e, 28: 0x1cc1a, 29: 0x1d33f, 30: 0x1ed75,
    31: 0x1f250, 32: 0x209d5, 33: 0x216f0, 34: 0x228ba, 35: 0x2379f, 36: 0x24b0b,
    37: 0x2542e, 38: 0x26a64, 39: 0x27541, 40: 0x28c69,
  };

  // フォーマット情報のBCH符号（マスクパターン適用済み, [ecIndicator][maskPattern]）
  function formatInfoBits(ecIndicator, maskPattern) {
    const data = (ecIndicator << 3) | maskPattern; // 5bit
    let bch = data << 10;
    const generator = 0b10100110111;
    for (let i = 14; i >= 10; i--) {
      if (bch & (1 << i)) bch ^= generator << (i - 10);
    }
    let result = ((data << 10) | bch) ^ 0b101010000010010;
    return result;
  }

  function getMatrixSize(version) {
    return version * 4 + 17;
  }

  // matrixはセル値: null=未確定, 0/1=データ, それ以外は機能パターンとしてtype付きで管理
  function createMatrix(version) {
    const size = getMatrixSize(version);
    const matrix = [];
    const isFunction = [];
    for (let i = 0; i < size; i++) {
      matrix.push(new Array(size).fill(0));
      isFunction.push(new Array(size).fill(false));
    }
    return { size, matrix, isFunction };
  }

  function setModule(m, row, col, value, isFn) {
    if (row < 0 || row >= m.size || col < 0 || col >= m.size) return;
    m.matrix[row][col] = value;
    m.isFunction[row][col] = isFn !== false;
  }

  function placeFinderPattern(m, row, col) {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const rr = row + r;
        const cc = col + c;
        if (rr < 0 || rr >= m.size || cc < 0 || cc >= m.size) continue;
        let val;
        if (r >= 0 && r <= 6 && c >= 0 && c <= 6 && (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4))) {
          val = 1;
        } else {
          val = 0;
        }
        setModule(m, rr, cc, val, true);
      }
    }
  }

  function placeAlignmentPattern(m, row, col) {
    for (let r = -2; r <= 2; r++) {
      for (let c = -2; c <= 2; c++) {
        const val = (Math.abs(r) === 2 || Math.abs(c) === 2 || (r === 0 && c === 0)) ? 1 : 0;
        setModule(m, row + r, col + c, val, true);
      }
    }
  }

  function placeTimingPatterns(m) {
    for (let i = 8; i < m.size - 8; i++) {
      const val = i % 2 === 0 ? 1 : 0;
      if (!m.isFunction[6][i]) setModule(m, 6, i, val, true);
      if (!m.isFunction[i][6]) setModule(m, i, 6, val, true);
    }
  }

  function placeAlignmentPatterns(m, version) {
    const positions = ALIGNMENT_POSITIONS[version];
    for (const row of positions) {
      for (const col of positions) {
        // ファインダパターンと重なる位置(左上・右上・左下)はスキップ
        if (
          (row === 6 && col === 6) ||
          (row === 6 && col === m.size - 7) ||
          (row === m.size - 7 && col === 6)
        ) continue;
        placeAlignmentPattern(m, row, col);
      }
    }
  }

  function reserveFormatAreas(m, version) {
    // フォーマット情報用領域を予約（値は後で設定）
    for (let i = 0; i < 9; i++) {
      if (!m.isFunction[8][i]) setModule(m, 8, i, 0, true);
      if (!m.isFunction[i][8]) setModule(m, i, 8, 0, true);
    }
    for (let i = 0; i < 8; i++) {
      setModule(m, 8, m.size - 1 - i, 0, true);
      setModule(m, m.size - 1 - i, 8, 0, true);
    }
    setModule(m, m.size - 8, 8, 0, true);

    // バージョン情報領域（バージョン7以上）
    if (version >= 7) {
      for (let r = 0; r < 6; r++) {
        for (let c = 0; c < 3; c++) {
          setModule(m, m.size - 11 + c, r, 0, true);
          setModule(m, r, m.size - 11 + c, 0, true);
        }
      }
    }
  }

  function placeFormatInfo(m, ecIndicator, maskPattern) {
    const bits = formatInfoBits(ecIndicator, maskPattern);
    // bits は15bit (bit14が先頭)
    const getBit = (i) => (bits >> i) & 1;

    // 左上〜下に縦配置 + 右上〜横配置（規格の配置順）
    for (let i = 0; i <= 5; i++) setModule(m, 8, i, getBit(i), true);
    setModule(m, 8, 7, getBit(6), true);
    setModule(m, 8, 8, getBit(7), true);
    setModule(m, 7, 8, getBit(8), true);
    for (let i = 9; i <= 14; i++) setModule(m, 14 - i, 8, getBit(i), true);

    for (let i = 0; i <= 7; i++) setModule(m, m.size - 1 - i, 8, getBit(i), true);
    for (let i = 8; i <= 14; i++) setModule(m, 8, m.size - 15 + i, getBit(i), true);
  }

  function placeVersionInfo(m, version) {
    if (version < 7) return;
    const bits = VERSION_INFO_BITS[version]; // 18bit
    for (let i = 0; i < 18; i++) {
      const bit = (bits >> i) & 1;
      const row = Math.floor(i / 3);
      const col = i % 3;
      setModule(m, m.size - 11 + col, row, bit, true);
      setModule(m, row, m.size - 11 + col, bit, true);
    }
  }

  // データビットをジグザグでマトリクスに配置
  function placeData(m, allCodewords) {
    const bits = [];
    for (const byte of allCodewords) {
      for (let i = 7; i >= 0; i--) bits.push((byte >> i) & 1);
    }

    let bitIndex = 0;
    let row = m.size - 1;
    let col = m.size - 1;
    let dir = -1; // -1: 上へ, 1: 下へ

    while (col > 0) {
      if (col === 6) col--; // タイミングパターンの列をスキップ

      while (true) {
        for (let c = 0; c < 2; c++) {
          const cc = col - c;
          if (!m.isFunction[row][cc]) {
            const bit = bitIndex < bits.length ? bits[bitIndex] : 0;
            setModule(m, row, cc, bit, false);
            bitIndex++;
          }
        }
        if (dir === -1) {
          if (row === 0) break;
          row--;
        } else {
          if (row === m.size - 1) break;
          row++;
        }
      }
      dir = -dir;
      col -= 2;
    }
    return bitIndex;
  }

  /* ---------- マスクパターン ---------- */
  function getMaskFunction(pattern) {
    switch (pattern) {
      case 0: return (r, c) => (r + c) % 2 === 0;
      case 1: return (r, c) => r % 2 === 0;
      case 2: return (r, c) => c % 3 === 0;
      case 3: return (r, c) => (r + c) % 3 === 0;
      case 4: return (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
      case 5: return (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0;
      case 6: return (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0;
      case 7: return (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0;
      default: return () => false;
    }
  }

  function applyMask(m, pattern) {
    const maskFn = getMaskFunction(pattern);
    const masked = m.matrix.map((rowArr) => rowArr.slice());
    for (let r = 0; r < m.size; r++) {
      for (let c = 0; c < m.size; c++) {
        if (!m.isFunction[r][c] && maskFn(r, c)) {
          masked[r][c] ^= 1;
        }
      }
    }
    return masked;
  }

  /* ---------- マスク評価（ペナルティ） ---------- */
  function evaluateMask(matrix, size) {
    let penalty = 0;

    // 規則1: 同色が5連続以上（行・列）
    for (let r = 0; r < size; r++) {
      penalty += runPenalty(matrix[r]);
      penalty += runPenalty(matrix.map((row) => row[r]));
    }

    // 規則2: 2x2の同色ブロック
    for (let r = 0; r < size - 1; r++) {
      for (let c = 0; c < size - 1; c++) {
        const v = matrix[r][c];
        if (v === matrix[r][c + 1] && v === matrix[r + 1][c] && v === matrix[r + 1][c + 1]) {
          penalty += 3;
        }
      }
    }

    // 規則3: 1:1:3:1:1（暗:明:暗暗暗:明:暗）のファインダ類似パターン
    const pattern1 = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
    const pattern2 = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
    for (let r = 0; r < size; r++) {
      for (let c = 0; c <= size - 11; c++) {
        const slice = matrix[r].slice(c, c + 11);
        if (arraysEqual(slice, pattern1) || arraysEqual(slice, pattern2)) penalty += 40;
      }
    }
    for (let c = 0; c < size; c++) {
      const col = matrix.map((row) => row[c]);
      for (let r = 0; r <= size - 11; r++) {
        const slice = col.slice(r, r + 11);
        if (arraysEqual(slice, pattern1) || arraysEqual(slice, pattern2)) penalty += 40;
      }
    }

    // 規則4: 暗モジュールの比率
    let dark = 0;
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (matrix[r][c]) dark++;
      }
    }
    const ratio = (dark * 100) / (size * size);
    const prevMultiple = Math.floor(ratio / 5) * 5;
    const nextMultiple = prevMultiple + 5;
    penalty += Math.min(Math.abs(prevMultiple - 50), Math.abs(nextMultiple - 50)) * 2;

    return penalty;
  }

  function arraysEqual(a, b) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }

  function runPenalty(line) {
    let penalty = 0;
    let runLength = 1;
    for (let i = 1; i < line.length; i++) {
      if (line[i] === line[i - 1]) {
        runLength++;
      } else {
        if (runLength >= 5) penalty += 3 + (runLength - 5);
        runLength = 1;
      }
    }
    if (runLength >= 5) penalty += 3 + (runLength - 5);
    return penalty;
  }

  /* ---------- メイン: QRコード生成 ---------- */
  // 戻り値: { version, size, modules: number[][] (0/1), ecLevel, maskPattern }
  function encode(text, ecLevel) {
    if (typeof text !== "string") throw new Error("text must be a string");
    if (!EC_LEVELS.hasOwnProperty(ecLevel)) throw new Error("invalid ecLevel");

    const bytes = toUtf8Bytes(text);
    if (bytes.length === 0) throw new Error("empty text");

    const mode = detectMode(text);
    const unitLength = mode === "byte" ? bytes.length : text.length;

    const version = findMinVersion(mode, unitLength, ecLevel);
    if (version === null) {
      throw new Error("データが長すぎます（最大バージョン40の容量を超えています）");
    }

    const dataCodewords = buildDataCodewords(text, mode, version, ecLevel);
    const allCodewords = interleaveWithECC(dataCodewords, version, ecLevel);

    // ベースマトリクスを構築（機能パターン配置）
    const base = createMatrix(version);
    placeFinderPattern(base, 0, 0);
    placeFinderPattern(base, 0, base.size - 7);
    placeFinderPattern(base, base.size - 7, 0);
    placeAlignmentPatterns(base, version);
    placeTimingPatterns(base);
    reserveFormatAreas(base, version);
    placeVersionInfo(base, version);

    // データを配置（isFunctionでない領域へ）
    placeData(base, allCodewords);

    // 8種のマスクを試して最小ペナルティを選択
    let bestPattern = 0;
    let bestPenalty = Infinity;
    let bestMatrix = null;
    for (let pattern = 0; pattern < 8; pattern++) {
      const masked = applyMask(base, pattern);
      // フォーマット情報を仮置きして評価（フォーマット領域はisFunctionなのでapplyMaskで変化しないため、評価前に正しい値を入れる）
      const withFormat = masked.map((row) => row.slice());
      writeFormatInfo(withFormat, base, EC_INDICATOR[ecLevel], pattern);
      const penalty = evaluateMask(withFormat, base.size);
      if (penalty < bestPenalty) {
        bestPenalty = penalty;
        bestPattern = pattern;
        bestMatrix = withFormat;
      }
    }

    return {
      version,
      size: base.size,
      modules: bestMatrix,
      ecLevel,
      maskPattern: bestPattern,
    };
  }

  // フォーマット情報ビットをマトリクスの該当セルへ書き込むヘルパー
  function writeFormatInfo(matrix, base, ecIndicator, maskPattern) {
    const bits = formatInfoBits(ecIndicator, maskPattern);
    const getBit = (i) => (bits >> i) & 1;
    const size = base.size;

    for (let i = 0; i <= 5; i++) matrix[8][i] = getBit(i);
    matrix[8][7] = getBit(6);
    matrix[8][8] = getBit(7);
    matrix[7][8] = getBit(8);
    for (let i = 9; i <= 14; i++) matrix[14 - i][8] = getBit(i);

    for (let i = 0; i <= 7; i++) matrix[size - 1 - i][8] = getBit(i);
    for (let i = 8; i <= 14; i++) matrix[8][size - 15 + i] = getBit(i);
  }

  global.QRCodeLib = {
    encode,
    detectMode,
    findMinVersion,
    getMatrixSize,
    EC_LEVELS,
    // テスト用に内部関数を公開
    _internal: { estimateBitLength, totalDataCodewords, RS_BLOCKS },
  };
})(typeof window !== "undefined" ? window : globalThis);
