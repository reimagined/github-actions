module.exports = {
  mode: 'production',
  watch: false,
  target: 'node',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        exclude: /node_modules/,
        use: {
          loader: 'ts-loader',
          options: {
            transpileOnly: false, // Set to true if you are using fork-ts-checker-webpack-plugin
            projectReferences: true,
          },
        },
      },
    ],
  },

  resolve: {
    extensions: ['.js', '.ts', '.tsx'],
  },
}
