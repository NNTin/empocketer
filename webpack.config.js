module.exports = options => {
  return {
    entry: ['whatwg-fetch', './react_modules/reactmodules.js'],
    output: {
      filename: '../public/javascripts/reactbundle.js',
    },
    mode: 'none',
    module: {
      rules: [
        {
          test: /.js$/,
          exclude: /node_modules/,
          use: [
            {
              loader: 'babel-loader',
              options: {
                cacheDirectory: true,
              },
            },
          ],
        },
      ],
    },
  }
}