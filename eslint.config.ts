import { type Config, defineConfig } from '@poupe/eslint-config';

const config: Config[] = defineConfig(
  {
    ignores: [
      '.claude/**/memory',
      '.tmp',
      '**/coverage',
    ],
  },
  {
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
);

export default config;
