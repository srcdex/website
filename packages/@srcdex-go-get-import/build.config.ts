import { defineBuildConfig } from 'obuild/config';

export default defineBuildConfig({
  entries: [
    { type: 'bundle', input: ['./src/index.ts'] },
  ],
  hooks: {
    rolldownConfig(config) {
      // obuild's remove-comments plugin (0.4.37) rewrites
      // chunks without emitting a sourcemap, invalidating
      // the maps requested below. Keeping comments in dist
      // is harmless; broken sourcemaps are not.
      const { plugins } = config;
      if (Array.isArray(plugins)) {
        config.plugins = plugins.filter((plugin) =>
          !(plugin instanceof Object &&
            'name' in plugin &&
            plugin.name === 'remove-comments'),
        );
      }
    },
    rolldownOutput(outConfig) {
      outConfig.sourcemap = true;
    },
  },
});
