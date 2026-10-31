import { defineConfig, loadEnv, type Plugin } from 'vite';

/**
 * Puts the built CSS into index.html as a <style>, so the first screen paints
 * without waiting for one more request (14 kB, 4 kB gzipped). Its url()s
 * start with `base`, so they resolve the same from the page.
 */
function inlineCss(): Plugin {
  return {
    name: 'inline-css',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const html = bundle['index.html'];
      if (html === undefined || html.type !== 'asset') return;
      let source = String(html.source);
      for (const file of Object.values(bundle)) {
        if (file.type !== 'asset' || !file.fileName.endsWith('.css')) continue;
        const name = file.fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const link = new RegExp(`<link rel="stylesheet"[^>]*href="[^"]*${name}"[^>]*>`);
        if (!link.test(source)) continue;
        source = source.replace(link, () => `<style>${String(file.source)}</style>`);
        delete bundle[file.fileName];
      }
      html.source = source;
    },
  };
}

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
    plugins: [inlineCss()],
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
