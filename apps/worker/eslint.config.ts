import {
  type Config,
  defineConfig,
  withAbbreviations,
} from '@poupe/eslint-config';

const config: Config[] = defineConfig(
  {
    ignores: ['.wrangler', 'coverage'],
  },
  withAbbreviations(['ctx']),
  {
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
);

export default config;
