/**
 * Brand marks. These are third-party / product artwork and keep their own
 * colours — the one place raw colour values are allowed (see DESIGN.md).
 */

/** Brand mark. Its greens are the logo's own artwork, not UI tokens. */
export function PerpLogo({ className = "size-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {/* Background: 3x3 grid of green squares */}
      <g id="background">
        <rect x="0" y="0" width="341.333" height="341.333" fill="#a8f0cb"/>
        <rect x="341.333" y="0" width="341.333" height="341.333" fill="#47da93"/>
        <rect x="682.667" y="0" width="341.333" height="341.333" fill="#7beab5"/>
        <rect x="0" y="341.333" width="341.333" height="341.333" fill="#38bd7b"/>
        <rect x="341.333" y="341.333" width="341.333" height="341.333" fill="#4bcd8c"/>
        <rect x="682.667" y="341.333" width="341.333" height="341.333" fill="#98edc3"/>
        <rect x="0" y="682.667" width="341.333" height="341.333" fill="#22915c"/>
        <rect x="341.333" y="682.667" width="341.333" height="341.333" fill="#32b775"/>
        <rect x="682.667" y="682.667" width="341.333" height="341.333" fill="#4ada94"/>
      </g>
      {/* Letter P: Geometric flat design */}
      <g id="letter" fill="#ffffff" fillRule="evenodd">
        <path d="
          M 295 175
          L 540 175
          C 590 175 635 185 670 210
          C 705 235 730 270 745 315
          C 760 360 760 410 745 455
          C 730 500 705 535 670 560
          C 635 585 590 595 540 595
          L 455 595
          L 455 849
          L 295 849
          L 295 175
          Z
          M 455 315
          L 455 455
          L 520 455
          C 545 455 565 450 580 435
          C 595 420 600 400 600 385
          C 600 370 595 350 580 335
          C 565 320 545 315 520 315
          L 455 315
          Z
        "/>
      </g>
    </svg>
  );
}

export function OkxLogo({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="currentColor" className={className} aria-hidden="true">
      <path d="M19.67 12.33h-7.34c-.18 0-.33.15-.33.33v7.34c0 .18.15.33.33.33h7.34c.18 0 .33-.15.33-.33v-7.34c0-.18-.15-.33-.33-.33z"/>
      <path d="M11.67 4h-7.34c-.18 0-.33.15-.33.33v7.34c0 .18.15.33.33.33h7.34c.18 0 .33-.15.33-.33V4.33c0-.18-.15-.33-.33-.33z"/>
      <path d="M27.67 4h-7.34c-.18 0-.33.15-.33.33v7.34c0 .18.15.33.33.33h7.34c.18 0 .33-.15.33-.33V4.33c0-.18-.15-.33-.33-.33z"/>
      <path d="M11.67 20h-7.34c-.18 0-.33.15-.33.33v7.34c0 .18.15.33.33.33h7.34c.18 0 .33-.15.33-.33v-7.34c0-.18-.15-.33-.33-.33z"/>
      <path d="M27.67 20h-7.34c-.18 0-.33.15-.33.33v7.34c0 .18.15.33.33.33h7.34c.18 0 .33-.15.33-.33v-7.34c0-.18-.15-.33-.33-.33z"/>
    </svg>
  );
}

/** Official brand asset, brand colour #97FCE4 */
export function HyperliquidLogo({ className = "size-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 144 144" fill="#97FCE4" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M144 71.6991C144 119.306 114.866 134.582 99.5156 120.98C86.8804 109.889 83.1211 86.4521 64.116 84.0456C39.9942 81.0113 37.9057 113.133 22.0334 113.133C3.5504 113.133 0 86.2428 0 72.4315C0 58.3063 3.96809 39.0542 19.736 39.0542C38.1146 39.0542 39.1588 66.5722 62.132 65.1073C85.0007 63.5379 85.4184 34.8689 100.247 22.6271C113.195 12.0593 144 23.4641 144 71.6991Z" />
    </svg>
  );
}

export function XLogo({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>
  );
}
