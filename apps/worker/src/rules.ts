import type { GoGetHostRules } from '@srcdex/go-get-import';

/**
 * Rule tables per hostname served by this worker: the bare
 * `srcdex.dev` module maps to the srcdex/srcdex repository.
 */
export const hostRules: GoGetHostRules = {
  'srcdex.dev': [
    { repo: 'https://github.com/srcdex/srcdex' },
  ],
};
