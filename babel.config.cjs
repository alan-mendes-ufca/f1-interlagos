// Só o Jest usa o Babel (o build é do Vite/TypeScript): transpila TS e ESM para CommonJS.
module.exports = {
  presets: [['@babel/preset-env', { targets: { node: 'current' } }], '@babel/preset-typescript'],
};
