import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';

const config = fs.readFileSync('vite.config.ts', 'utf8');
const start = config.indexOf('function mapServiceWorkerPlugin()');
const isolated = config.slice(start, config.indexOf('function tailwindCliPlugin()', start));
const executable = ts.transpileModule(isolated, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;

function fixture() {
  const root = path.resolve('temporary checkout with spaces 折叠屏');
  const sourceRoot = path.join(root, 'apps/Map/sw');
  const files = new Map<string, Buffer>([
    [path.join(sourceRoot, 'map-sw.js'), Buffer.from('owned map worker')],
    [path.join(sourceRoot, 'vector/bootstrap-manifest.json'), Buffer.from('{"entries":[]}')],
  ]);
  const fakeFs = {
    existsSync: (file: string) => files.has(file),
    readFileSync: (file: string) => {
      if (!files.has(file)) throw new Error('Missing required source: ' + file);
      return files.get(file);
    },
    createReadStream: (file: string) => ({ pipe: (res: any) => { res.servedPath = file; } }),
  };
  const plugin = vm.runInNewContext(executable + ';mapServiceWorkerPlugin()', { fs: fakeFs, path, Buffer, __dirname: root });
  const uses: any[][] = [];
  const server = { middlewares: { use: (...args: any[]) => uses.push(args) } };
  const request = (middleware: any, url: string) => {
    const next = vi.fn();
    const res = { statusCode: 200, setHeader: vi.fn(), end: vi.fn(), servedPath: undefined as string | undefined };
    middleware({ url }, res, next);
    return { res, next };
  };
  return { root, sourceRoot, files, plugin, server, uses, request };
}

describe('Map build delivery rather than source-only preview', () => {
  it('emits both required assets through Rollup, independent of a fixed dist directory', () => {
    const { plugin, files, sourceRoot } = fixture();
    const emitFile = vi.fn();
    plugin.generateBundle.call({ emitFile });
    expect(emitFile.mock.calls.map(([asset]) => asset.fileName)).toEqual([
      'map-sw.js', 'map-vector-cache/bootstrap-manifest.json',
    ]);
    expect(emitFile.mock.calls[0][0].source).toEqual(files.get(path.join(sourceRoot, 'map-sw.js')));
    expect(emitFile.mock.calls[1][0].source).toEqual(files.get(path.join(sourceRoot, 'vector/bootstrap-manifest.json')));
    expect(plugin.closeBundle).toBeUndefined();
  });

  it.each(['map-sw.js', 'vector/bootstrap-manifest.json'])('fails a partial build when %s is missing', file => {
    const { plugin, files, sourceRoot } = fixture();
    files.delete(path.join(sourceRoot, file));
    expect(() => plugin.generateBundle.call({ emitFile: vi.fn() })).toThrow('Missing required source');
  });

  it.each(['../artifacts/custom build', path.resolve('absolute custom build')])('preview serves only the resolved outDir worker and bootstrap (%s)', outDir => {
    const { root, plugin, server, uses, request, files } = fixture();
    plugin.configResolved({ root, build: { outDir } });
    const buildRoot = path.resolve(root, outDir);
    files.set(path.join(buildRoot, 'map-sw.js'), Buffer.from('delivered worker'));
    files.set(path.join(buildRoot, 'map-vector-cache/bootstrap-manifest.json'), Buffer.from('delivered manifest'));
    plugin.configurePreviewServer(server);
    const sw = request(uses[0][0], '/map-sw.js?cdnBase=/cdn');
    expect(sw.res.servedPath).toBe(path.join(buildRoot, 'map-sw.js'));
    expect(sw.res.setHeader).toHaveBeenCalledWith('Service-Worker-Allowed', '/');
    expect(sw.next).not.toHaveBeenCalled();
    const bootstrap = request(uses[1][0], '/map-vector-cache/bootstrap-manifest.json');
    expect(bootstrap.res.servedPath).toBe(path.join(buildRoot, 'map-vector-cache/bootstrap-manifest.json'));
    expect(bootstrap.next).not.toHaveBeenCalled();
  });

  it('a source file cannot conceal missing preview delivery or become an HTML success', () => {
    const { root, plugin, server, uses, request } = fixture();
    plugin.configResolved({ root, build: { outDir: '../artifacts/missing build' } });
    plugin.configurePreviewServer(server);
    for (const [middleware, url] of [[uses[0][0], '/map-sw.js'],
      [uses[1][0], '/map-vector-cache/bootstrap-manifest.json']]) {
      const { res, next } = request(middleware, url);
      expect(res.statusCode).toBe(404);
      expect(res.servedPath).toBeUndefined();
      expect(next).not.toHaveBeenCalled();
    }
  });

  it('development retains source SW and unrelated paths pass through', () => {
    const { plugin, server, uses, request, sourceRoot } = fixture();
    plugin.configureServer(server);
    expect(request(uses[0][0], '/map-sw.js').res.servedPath).toBe(path.join(sourceRoot, 'map-sw.js'));
    expect(request(uses[0][0], '/unrelated.js').next).toHaveBeenCalledTimes(1);
  });
});
