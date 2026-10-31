import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ command, mode }) => {
  let base = '/';

  // og:url and og:image need an absolute URL; a missing value would ship
  // the literal %VITE_SITE_URL% placeholder and break link previews.
  if (command === 'build') {
    const siteUrl = loadEnv(mode, process.cwd(), 'VITE_').VITE_SITE_URL ?? '';
    if (!/^https:\/\/[^/]+(\/.*[^/])?$/.test(siteUrl)) {
      throw new Error('VITE_SITE_URL must be an https URL without a trailing slash');
    }
    // a site in a subfolder (GitHub Pages project site) needs the same base for assets
    base = `${new URL(siteUrl).pathname.replace(/\/$/, '')}/`;
  }

  return {
    base,
    build: {
      target: 'es2020',
      minify: 'esbuild',
      cssMinify: true,
      sourcemap: false,
      assetsInlineLimit: 0,
      rollupOptions: {
        output: {
          entryFileNames: 'assets/[name]-[hash].js',
          chunkFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash][extname]',
        },
      },
    },
    server: {
      port: 5173,
    },
  };
});
