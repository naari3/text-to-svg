/**
 * Copyright (c) 2016 Hideki Shiro
 */

import * as opentype from 'opentype.js';

// const DEFAULT_FONT = (await import("path")).join(__dirname, '../fonts/ipag.ttf');
// import { join } from 'path';
// const DEFAULT_FONT = join(__dirname, '../fonts/ipag.ttf');
const DEFAULT_FONT = './fonts/ipag.ttf';

// Private method

function parseAnchorOption(anchor: string) {
  const hol = anchor.match(/left|center|right/gi) || [];
  const horizontal = hol.length === 0 ? 'left' : hol[0];

  let ver = anchor.match(/baseline|top|bottom|middle/gi) || [];
  const vertical = ver.length === 0 ? 'baseline' : ver[0];

  return { horizontal, vertical };
}

interface TextOptions {
  fontSize?: number;
  kerning?: boolean;
  letterSpacing?: number;
  tracking?: number;
  anchor?: string;
  x?: number;
  y?: number;
  attributes?: Record<string, any>;
}


export default class TextToSVG {
  font: opentype.Font;
  constructor(font: opentype.Font) {
    this.font = font;
  }

  static loadSync(file = DEFAULT_FONT) {
    return new TextToSVG(opentype.loadSync(file));
  }

  static load(url: string, cb: (error: any, t2s?: TextToSVG) => void) {
    opentype.load(url, (err, font) => {
      if (err !== null || !font) {
        return cb(err, undefined);
      }

      return cb(null, new TextToSVG(font));
    });
  }

  getWidth(text: string, options: TextOptions) {
    const fontSize = options.fontSize || 72;
    const kerning = 'kerning' in options ? options.kerning : true;
    const fontScale = 1 / this.font.unitsPerEm * fontSize;

    let width = 0;
    const glyphs = this.font.stringToGlyphs(text);
    for (let i = 0; i < glyphs.length; i++) {
      const glyph = glyphs[i];

      if (glyph.advanceWidth) {
        width += glyph.advanceWidth * fontScale;
      }

      if (kerning && i < glyphs.length - 1) {
        const kerningValue = this.font.getKerningValue(glyph, glyphs[i + 1]);
        width += kerningValue * fontScale;
      }

      if (options.letterSpacing) {
        width += options.letterSpacing * fontSize;
      } else if (options.tracking) {
        width += (options.tracking / 1000) * fontSize;
      }
    }
    return width;
  }

  getHeight(fontSize: number) {
    const fontScale = 1 / this.font.unitsPerEm * fontSize;
    return (this.font.ascender - this.font.descender) * fontScale;
  }

  getMetrics(text: string, options: TextOptions = {}) {
    const fontSize = options.fontSize || 72;
    const widths: number[] = [];
    const heights: number[] = [];
    text.split("\n").forEach((line, i) => {
      widths.push(this.getWidth(line, options));
      heights.push(this.getHeight(fontSize));
    });
    const anchor = parseAnchorOption(options.anchor || '');

    const width = Math.max(...widths);
    const height = heights.reduce((a, b) => a + b, 0);

    const fontScale = 1 / this.font.unitsPerEm * fontSize;
    const ascender = this.font.ascender * fontScale;
    const descender = this.font.descender * fontScale;

    let x = options.x || 0;
    switch (anchor.horizontal) {
      case 'left':
        x -= 0;
        break;
      case 'center':
        x -= width / 2;
        break;
      case 'right':
        x -= width;
        break;
      default:
        throw new Error(`Unknown anchor option: ${anchor.horizontal}`);
    }

    let y = options.y || 0;
    switch (anchor.vertical) {
      case 'baseline':
        y -= ascender;
        break;
      case 'top':
        y -= 0;
        break;
      case 'middle':
        y -= height / 2;
        break;
      case 'bottom':
        y -= height;
        break;
      default:
        throw new Error(`Unknown anchor option: ${anchor.vertical}`);
    }

    const baseline = y + ascender;

    return {
      x,
      y,
      baseline,
      width,
      height,
      ascender,
      descender,
    };
  }

  getMetricsForLine(text: string, options: TextOptions = {}) {
    const fontSize = options.fontSize || 72;
    const anchor = parseAnchorOption(options.anchor || '');

    const width = this.getWidth(text, options);
    const height = this.getHeight(fontSize);

    const fontScale = 1 / this.font.unitsPerEm * fontSize;
    const ascender = this.font.ascender * fontScale;
    const descender = this.font.descender * fontScale;

    let x = options.x || 0;
    switch (anchor.horizontal) {
      case 'left':
        x -= 0;
        break;
      case 'center':
        x -= width / 2;
        break;
      case 'right':
        x -= width;
        break;
      default:
        throw new Error(`Unknown anchor option: ${anchor.horizontal}`);
    }

    let y = options.y || 0;
    switch (anchor.vertical) {
      case 'baseline':
        y -= ascender;
        break;
      case 'top':
        y -= 0;
        break;
      case 'middle':
        y -= height / 2;
        break;
      case 'bottom':
        y -= height;
        break;
      default:
        throw new Error(`Unknown anchor option: ${anchor.vertical}`);
    }

    const baseline = y + ascender;

    return {
      x,
      y,
      baseline,
      width,
      height,
      ascender,
      descender,
    };
  }

  getD(line: string, options: TextOptions = {}) {
    const fontSize = options.fontSize || 72;
    const kerning = 'kerning' in options ? options.kerning : true;
    const letterSpacing = 'letterSpacing' in options ? options.letterSpacing : undefined;
    const tracking = 'tracking' in options ? options.tracking : undefined;
    const metrics = this.getMetricsForLine(line, options);
    const path = this.font.getPath(line, metrics.x, metrics.baseline, fontSize, { kerning, letterSpacing, tracking });

    return path.toPathData(2);
  }

  getPath(text: string, options: TextOptions = {}) {
    const attributes = Object.keys(options.attributes || {})
    // @ts-ignore
      .map(key => `${key}="${options.attributes[key]}"`)
      .join(' ');
    const ds: string[] = [];
    text.split("\n").forEach((line, i) => {
      ds.push(this.getD(line, {...options, y: (options.y ?? 0) + (options.fontSize || 72) * i}));
    });
    const d = ds.join(" ");

    if (attributes) {
      return `<path ${attributes} d="${d}"/>`;
    }

    return `<path d="${d}"/>`;
  }

  getSVG(text: string, options: TextOptions = {}) {
    const metrics = this.getMetrics(text, options);
    const width = metrics.width;
    const height = metrics.height;
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}">`;
    svg += this.getPath(text, options);
    svg += '</svg>';

    return svg;
  }

  getDebugSVG(text: string, options: TextOptions = {}) {
    options = JSON.parse(JSON.stringify(options));

    options.x = options.x || 0;
    options.y = options.y || 0;
    const metrics = this.getMetrics(text, options);
    const box = {
      width: Math.max(metrics.x + metrics.width, 0) - Math.min(metrics.x, 0),
      height: Math.max(metrics.y + metrics.height, 0) - Math.min(metrics.y, 0),
    };
    const origin = {
      x: box.width - Math.max(metrics.x + metrics.width, 0),
      y: box.height - Math.max(metrics.y + metrics.height, 0),
    };

    // Shift text based on origin
    options.x += origin.x;
    options.y += origin.y;

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${box.width}" height="${box.height}">`;
    svg += `<path fill="none" stroke="red" stroke-width="1" d="M0,${origin.y}L${box.width},${origin.y}"/>`; // X Axis
    svg += `<path fill="none" stroke="red" stroke-width="1" d="M${origin.x},0L${origin.x},${box.height}"/>`; // Y Axis
    svg += this.getPath(text, options);
    svg += '</svg>';

    return svg;
  }
}
