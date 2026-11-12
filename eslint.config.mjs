import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

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
]);
