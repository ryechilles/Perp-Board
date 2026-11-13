import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

// ── UI system guard rails (DESIGN.md → Rules) ──────────────────────────────
// Tailwind scales are replaced by the system's tokens, so a class from outside
// the system would silently render nothing. These rules turn that into an error.
// They match class names inside any string or template literal.
const cls = (pattern, message) => [
  { selector: `Literal[value=/${pattern}/]`, message },
  { selector: `TemplateElement[value.raw=/${pattern}/]`, message },
];

const P = '(^|[\\s:])'; // start of a class (after a space or a variant prefix)
const COLOR_UTILS = '(bg|text|border|ring|from|via|to|fill|stroke|outline|divide|decoration|placeholder|caret|accent|shadow)';

/** Applies everywhere under components/ and app/. */
const tokenRules = [
  ...cls(`${P}text-(xs|sm|base|lg|xl|[2-9]xl)\\b`, 'Not in the type scale. Use text-caption / small / body / title / display.'),
  ...cls(`${P}rounded(-[trbl]{1,2})?(-(sm|md|lg|xl|2xl|3xl))?(\\s|$)`, 'Not in the radius scale. Use rounded-tag / control / panel / full.'),
  ...cls(`${P}font-(thin|extralight|light|bold|extrabold|black|mono|serif)\\b`, 'Not in the system. Weights are normal / medium / semibold; the only face is font-sans.'),
  ...cls(
    `${P}${COLOR_UTILS}-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\\d`,
    'Tailwind palette colours are not in the system. Use a token (fg, surface, line, accent, up, down, cold, hot…).'
  ),
  ...cls(
    `${P}${COLOR_UTILS}-(foreground|background|card|popover|primary|secondary|destructive|muted|muted-foreground|separator|tint|faint|segment|border|input|zone-neutral|(up|down|cold|hot)-(ink|soft))\\b`,
    'Old token name. See DESIGN.md → Tokens for the current names.'
  ),
  ...cls(`${P}${COLOR_UTILS}-\\[#`, 'No raw colours. Add or use a token.'),
];

/** Screens (everything outside components/ui and components/data) may not reach past the components. */
const screenRules = [
  ...cls(
    `${P}-?(text|leading|tracking|rounded|shadow|p[xytrbl]?|m[xytrbl]?|gap(-[xy])?|space-[xy]|[wh]|size|min-[wh]|max-[wh]|top|right|bottom|left|inset(-[xy])?)-\\[[^\\]]*\\d(px|rem|em)?\\]`,
    'No arbitrary sizes in screens. Use the scale; if a component needs a new size, add it to the component or the tokens.'
  ),
  {
    selector: "JSXOpeningElement[name.name='button']",
    message: 'Use <Button> / <IconButton> from @/components/ui (variant="bare" for a custom hit area).',
  },
];

const UI_FILES = ['components/**/*.{ts,tsx}', 'app/**/*.{ts,tsx}'];
const SYSTEM_FILES = ['components/ui/**', 'components/data/**'];

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores(['.next/**', '.open-next/**', 'node_modules/**', 'next-env.d.ts']),
  {
    // CommonJS tool configs (tailwind / postcss / next) legitimately use require().
    files: ['*.config.js'],
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  {
    rules: {
      // Token logos are tiny third-party images loaded straight from their CDNs;
      // routing them through next/image would add a Worker hop for no gain.
      '@next/next/no-img-element': 'off',
      // React Compiler rules (new in eslint-plugin-react-hooks 7). This app does
      // not use the compiler, and it relies on two patterns they forbid: reading
      // a "latest value" ref during render, and hydrating state from
      // localStorage in a mount effect. Re-enable if the compiler is adopted.
      'react-hooks/refs': 'off',
      'react-hooks/set-state-in-effect': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
    },
  },
  // The system itself: token names only.
  { files: SYSTEM_FILES, rules: { 'no-restricted-syntax': ['error', ...tokenRules] } },
  // Screens: token names only, and nothing below the component layer.
  { files: UI_FILES, ignores: SYSTEM_FILES, rules: { 'no-restricted-syntax': ['error', ...tokenRules, ...screenRules] } },
  // lib/ and hooks/ carry no presentation at all.
  {
    files: ['lib/**/*.ts', 'hooks/**/*.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        ...cls(`${P}${COLOR_UTILS}-(fg|surface|fill|line|accent|up|down|cold|hot|track|star)(-|\\/|\\s|$)`, 'lib/ returns meaning (a Tone), never class names. See lib/format.ts.'),
      ],
    },
  },
]);
