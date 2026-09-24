const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const ts=require("typescript");
const root=path.resolve(__dirname,"..");
// Compile the actual server modules with injected infrastructure, without a live DB or mail.
function load(file, mocks = {}) {
  const filename = path.resolve(root, file);
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const module = { exports: {} };
  const localRequire = name => {
    if (name === 'server-only') return {};
    if (Object.hasOwn(mocks, name)) return mocks[name];
    let resolvedRel = null;
    if (name.startsWith('@/')) {
      resolvedRel = name.slice(2);
    } else if (name.startsWith('.')) {
      resolvedRel = path.relative(root, path.resolve(path.dirname(filename), name)).replace(/\\/g, '/');
    }
    if (resolvedRel) {
      const relWithoutExt = resolvedRel.replace(/\.ts$/, '');
      if (Object.hasOwn(mocks, '@/' + relWithoutExt)) return mocks['@/' + relWithoutExt];
      if (Object.hasOwn(mocks, './' + path.basename(relWithoutExt))) return mocks['./' + path.basename(relWithoutExt)];
      if (Object.hasOwn(mocks, relWithoutExt)) return mocks[relWithoutExt];
      return load(relWithoutExt + '.ts', mocks);
    }
    return require(name);
  };
  vm.runInThisContext(`(function(require,module,exports){${source}\n})`, { filename })(localRequire, module, module.exports);
  return module.exports;
}

module.exports={load};
