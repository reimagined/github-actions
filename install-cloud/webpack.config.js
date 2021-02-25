const { merge } = require('webpack-merge')
const configBase = require('../webpack.config-base')

module.exports = merge(configBase, {
  entry: {
    main: './src/main-entry.ts',
  },
  output: {
    path: __dirname + '/dist',
    filename: '[name].js',
  },
  context: __dirname,
})
