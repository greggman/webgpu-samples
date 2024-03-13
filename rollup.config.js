import fs from 'fs';
import path from 'path';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import commonjs from '@rollup/plugin-commonjs';
import { readDirSyncRecursive } from './build/lib/readdir.js';

const outPath = 'out';

function wgslPlugin() {
  return {
    name: 'wgsl-plugin',
    transform(code, id) {
      if (id.endsWith('.wgsl')) {
        return {
          code: `export default \`${code}\`;`,
          map: { mappings: '' },
        };
      }
    },
  };
}

function makeRelativeToCWD(id) {
  return path.relative(process.cwd(), path.normalize(id)).replaceAll('\\', '/');
}

function filenamePlugin() {
  return {
    name: 'filename-plugin',
    transform(code, id) {
      return {
        code: code.replaceAll(
          '__DIRNAME__',
          () => `${JSON.stringify(makeRelativeToCWD(path.dirname(id)))}`
        ),
        map: { mappings: '' },
      };
    },
  };
}

/**
 * Given a path like sample/foo/main.ts then, if an index.html doesn't exist
 * in the same folder, generate a redirect index.html in the out folder.
 * Note:
 *    `samples/name/index.html` is a redirect (generated)
 *    `sample/name/index.html` is the live sample (the iframe's src)
 */
function writeRedirect(filename) {
  const sampleName = path.basename(path.dirname(filename));
  const dirname = path.join(outPath, 'samples', sampleName);
  const filepath = path.join(dirname, 'index.html');
  fs.mkdirSync(dirname, { recursive: true });
  console.log('created', filepath);
  fs.writeFileSync(
    filepath,
    `\
<!DOCTYPE html>
<html>
  <head>
      <meta
        http-equiv="refresh"
        content="0;URL='../../?sample=${path.basename(path.dirname(filename))}'"
      ></meta> 
  </head>
</html>
`
  );
}

/**
 * Writes a sitemap.xml for all the examples
 */
function writeSitemap(sampleFiles) {
  const makeSitemapEntry = (filename) => {
    const sampleName = path.basename(path.dirname(filename));
    const url = `https://webgpu.github.io/webgpu-samples/?sample=${sampleName}`;
    return `
      <url>
        <loc>${url}</loc> <changefreq>monthly</changefreq> <priority>0.5</priority> <xhtml:link rel="alternate" hreflang="en" href="${url}" /> </url>
    `;
  };

  const xml = `
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${sampleFiles.map(makeSitemapEntry).join('\n')}
</urlset>
`;

  {
    const filename = path.join(outPath, 'sitemap.xml');
    console.log('created', filename);
    fs.writeFileSync(filename, xml);
  }
  {
    const filename = path.join(outPath, 'robots.txt');
    console.log('created', filename);
    fs.writeFileSync(
      filename,
      'Sitemap: https://webgpu.github.io/webgpu/sitemap.xml\n'
    );
  }
}

const sampleFiles = readDirSyncRecursive('sample');

// Generate a sitemap for all samples
const allSamples = sampleFiles.filter((n) => n.endsWith('meta.ts'));
writeSitemap(allSamples);

// Generate redirects for all samples
sampleFiles
  .filter((n) => n.endsWith('/index.html'))
  .forEach((n) => writeRedirect(n));

const samplePlugins = [
  wgslPlugin(),
  nodeResolve(),
  commonjs(),
  typescript({ tsconfig: './sample/tsconfig.json' }),
];

// add a rollup rule for each sample
const samples = sampleFiles
  .filter((n) => n.endsWith('/main.ts') || n.endsWith('/worker.ts'))
  .map((filename) => {
    return {
      input: filename,
      output: [
        {
          file: `${outPath}/${filename.replace(/\.ts$/, '.js')}`,
          format: 'esm',
          sourcemap: true,
        },
      ],
      plugins: samplePlugins,
    };
  });

export default [
  {
    input: 'src/main.ts',
    output: [
      {
        file: `${outPath}/main.js`,
        format: 'esm',
        sourcemap: true,
      },
    ],
    plugins: [
      nodeResolve(),
      commonjs(),
      filenamePlugin(),
      typescript({ tsconfig: './src/tsconfig.json' }),
    ],
    watch: {
      clearScreen: false,
    },
  },
  ...samples,
];
