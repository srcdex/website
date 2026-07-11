import pkg from '../package.json' with { type: 'json' };

/** Package version from package.json. */
export const VERSION: string = pkg.version;

export type {
  CompiledExcludeRule,
  CompiledRepoRule,
  CompiledRule,
  CompiledRuleBase,
  ConsoleLike,
  ExcludeRule,
  ExecutionContextLike,
  GoGetHostRules,
  GoGetHostSettings,
  GoGetImportHandler,
  GoGetImportOptions,
  GoGetImportSettings,
  GoGetLogger,
  GoGetRouter,
  RedirectCode,
  RepoRule,
  Rule,
  RuleBase,
  RuleDefaults,
  RuleMatch,
} from './types';

export { escapeHTML } from './escape';
export { newGoGetHostRouter } from './hosts';
export { goGetHTML } from './html';
export { newConsoleLogger } from './logger';
export {
  compileRule,
  compileRules,
  DEFAULT_FILE_EXTENSIONS,
  isFilePath,
  matchPrefix,
  matchRules,
} from './match';
export { goImportMeta, goSourceMeta, isGitHubRepo } from './meta';
export { newGoGetRouter } from './router';
