import {
  type Config,
  defineConfig,
  withAbbreviations,
} from '@poupe/eslint-config';

const config: Config[] = defineConfig(
  {
    ignores: ['coverage'],
  },
  withAbbreviations(['ctx', 'dir', 'docs', 'ref']),
  {
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
);

export default config;
