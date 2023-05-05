const path = require('path');
const nodeExternals = require('webpack-node-externals');

const {
  NODE_ENV = 'production',
} = process.env;

module.exports = {
  entry: './src/main.ts',  // the file you would provide to ts-node or node binaries for execution
  mode: NODE_ENV,  // development or production
  target: 'node',  // webpack works differently based on target, here we use node.js
  output: {  // directions for the built files directory
    path: path.resolve(__dirname, 'build'),
    filename: 'main.js',
  },
  resolve: {
    // Bundle only typescript files
    extensions: ['.ts'],
    alias: {
    // provider any import aliases you may use in your project
    src: path.resolve(__dirname, '/'),
    },
  },
  module: {
    rules: [
    {
        test: /\.ts$/,   // this rule will only activate for files ending in .ts
        use: [{ loader: 'ts-loader' }],
        exclude: [  // exclude any files you don't want to include, eg test files
        /__tests__/,
        ],
    },
    ],
  },
  externals: [nodeExternals()],
  plugins: [
    // any plugins you may find useful
  ],
  optimization: {
    usedExports: true,
  },
}
