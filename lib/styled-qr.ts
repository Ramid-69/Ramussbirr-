import QRCode from 'qrcode';
import { CBE_QR_LOGO_BASE64 } from './qr-logo-base64';

export interface StyledQrOptions {
  size?: number;
  margin?: number;
  withCenterLogo?: boolean;
  centerLogoHref?: string;
  bgColor?: string;
}

/**
 * Generates an SVG string of an authentic CBE styled QR code.
 * Features:
 * - Rounded eye finder patterns (outer frame 7x7 with inner cutout 5x5, center 3x3 dot)
 * - Smooth rounded connected modules (pill/capsule styling matching the authentic CBEBirr app)
 * - Authentic CBE Birr Plus badge embedded as inline base64 so it renders in ALL browser contexts
 * - Error correction (level 'M') matching the 33x33 Version 4 layout of official CBE receipts
 */
export function generateStyledQrSvg(url: string, options: StyledQrOptions = {}): string {
  const {
    size = 360,
    margin = 1,
    withCenterLogo = true,
    centerLogoHref,
    bgColor = '#eeeeee',
  } = options;

  const resolvedLogoHref = (centerLogoHref && centerLogoHref.startsWith('data:'))
    ? centerLogoHref
    : CBE_QR_LOGO_BASE64;

  const qr = QRCode.create(url, { errorCorrectionLevel: 'M' });
  const count = qr.modules.size;
  const data = qr.modules.data;

  function isDark(x: number, y: number): boolean {
    if (x < 0 || x >= count || y < 0 || y >= count) return false;
    return data[y * count + x] === 1;
  }

  function isFinder(x: number, y: number): boolean {
    if (x < 7 && y < 7) return true; // Top-Left
    if (x >= count - 7 && y < 7) return true; // Top-Right
    if (x < 7 && y >= count - 7) return true; // Bottom-Left
    return false;
  }

  // Define center area reserved for logo (exact 5x5 modules around center, keeping surrounding modules spacious)
  const centerRadius = withCenterLogo ? 2 : 0;
  const centerMid = Math.floor(count / 2);
  function isCenter(x: number, y: number): boolean {
    if (!withCenterLogo) return false;
    return Math.abs(x - centerMid) <= centerRadius && Math.abs(y - centerMid) <= centerRadius;
  }

  const totalCount = count + margin * 2;
  const cell = size / totalCount;

  const svgPaths: string[] = [];

  // 1. Draw 3 Eye Finder patterns (authentic CBE rounded outer frame and rounded inner dot)
  const eyes = [
    { x: margin, y: margin },
    { x: margin + count - 7, y: margin },
    { x: margin, y: margin + count - 7 },
  ];

  for (const eye of eyes) {
    const ex = eye.x * cell;
    const ey = eye.y * cell;
    const outerSize = 7 * cell;
    const outerR = 1.6 * cell;
    const innerHoleR = 0.8 * cell;
    const innerDotR = 0.9 * cell;

    svgPaths.push(`
      <path fill="#000000" fill-rule="evenodd" d="
        M ${ex + outerR} ${ey}
        H ${ex + outerSize - outerR}
        A ${outerR} ${outerR} 0 0 1 ${ex + outerSize} ${ey + outerR}
        V ${ey + outerSize - outerR}
        A ${outerR} ${outerR} 0 0 1 ${ex + outerSize - outerR} ${ey + outerSize}
        H ${ex + outerR}
        A ${outerR} ${outerR} 0 0 1 ${ex} ${ey + outerSize - outerR}
        V ${ey + outerR}
        A ${outerR} ${outerR} 0 0 1 ${ex + outerR} ${ey}
        Z
        M ${ex + cell + innerHoleR} ${ey + cell}
        H ${ex + outerSize - cell - innerHoleR}
        A ${innerHoleR} ${innerHoleR} 0 0 1 ${ex + outerSize - cell} ${ey + cell + innerHoleR}
        V ${ey + outerSize - cell - innerHoleR}
        A ${innerHoleR} ${innerHoleR} 0 0 1 ${ex + outerSize - cell - innerHoleR} ${ey + outerSize - cell}
        H ${ex + cell + innerHoleR}
        A ${innerHoleR} ${innerHoleR} 0 0 1 ${ex + cell} ${ey + outerSize - cell - innerHoleR}
        V ${ey + cell + innerHoleR}
        A ${innerHoleR} ${innerHoleR} 0 0 1 ${ex + cell + innerHoleR} ${ey + cell}
        Z
      " />
      <rect x="${ex + 2 * cell}" y="${ey + 2 * cell}" width="${3 * cell}" height="${3 * cell}" rx="${innerDotR}" ry="${innerDotR}" fill="#000000" />
    `);
  }

  // 2. Draw Data Modules with smooth connected / rounded shape and seam overlap to eliminate hairlines
  const overlap = 0.18;
  for (let y = 0; y < count; y++) {
    for (let x = 0; x < count; x++) {
      if (isFinder(x, y)) continue;
      if (isCenter(x, y)) continue;
      if (!isDark(x, y)) continue;

      let px = (margin + x) * cell;
      let py = (margin + y) * cell;
      let w = cell;
      let h = cell;

      const top = isDark(x, y - 1) && !isFinder(x, y - 1) && !isCenter(x, y - 1);
      const bottom = isDark(x, y + 1) && !isFinder(x, y + 1) && !isCenter(x, y + 1);
      const left = isDark(x - 1, y) && !isFinder(x - 1, y) && !isCenter(x - 1, y);
      const right = isDark(x + 1, y) && !isFinder(x + 1, y) && !isCenter(x + 1, y);

      if (top) { py -= overlap; h += overlap; }
      if (bottom) { h += overlap; }
      if (left) { px -= overlap; w += overlap; }
      if (right) { w += overlap; }

      const r = cell * 0.44;

      const rtl = !top && !left ? r : 0;
      const rtr = !top && !right ? r : 0;
      const rbr = !bottom && !right ? r : 0;
      const rbl = !bottom && !left ? r : 0;

      svgPaths.push(`
        <path fill="#000000" d="
          M ${px + rtl} ${py}
          H ${px + w - rtr}
          ${rtr ? `A ${rtr} ${rtr} 0 0 1 ${px + w} ${py + rtr}` : `L ${px + w} ${py}`}
          V ${py + h - rbr}
          ${rbr ? `A ${rbr} ${rbr} 0 0 1 ${px + w - rbr} ${py + h}` : `L ${px + w} ${py + h}`}
          H ${px + rbl}
          ${rbl ? `A ${rbl} ${rbl} 0 0 1 ${px} ${py + h - rbl}` : `L ${px} ${py + h}`}
          V ${py + rtl}
          ${rtl ? `A ${rtl} ${rtl} 0 0 1 ${px + rtl} ${py}` : `L ${px} ${py}`}
          Z
        " />
      `);
    }
  }

  // 3. Center Logo matching authentic CBE receipt PNG design
  let centerLogoMarkup = '';
  if (withCenterLogo && resolvedLogoHref) {
    const logoW = 7.0 * cell;
    const logoH = 7.0 * cell;
    const logoX = (size - logoW) / 2;
    const logoY = (size - logoH) / 2;

    centerLogoMarkup = `
      <rect x="${logoX}" y="${logoY}" width="${logoW}" height="${logoH}" rx="${cell * 1.2}" ry="${cell * 1.2}" fill="#ffffff" />
      <image href="${resolvedLogoHref}" x="${logoX}" y="${logoY}" width="${logoW}" height="${logoH}" preserveAspectRatio="xMidYMid meet" />
    `;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    ${bgColor ? `<rect width="${size}" height="${size}" fill="${bgColor}" />` : ''}
    ${svgPaths.join('')}
    ${centerLogoMarkup}
  </svg>`;
}

/**
 * Returns a data URL of the styled QR SVG for embedding directly in <img> tags.
 */
export function generateStyledQrDataUrl(url: string, options: StyledQrOptions = {}): string {
  const svg = generateStyledQrSvg(url, options);
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
