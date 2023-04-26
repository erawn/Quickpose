const withPWA = require('next-pwa')
const withTM = require('next-transpile-modules')
const path = require('path')
const {
  GITHUB_ID,
  GA_ID_QUICKPOSE,
  GITHUB_API_SECRET,
  NODE_ENV,
  VERCEL_GIT_COMMIT_SHA,
  GA_MEASUREMENT_ID,
  DATA_KEY,
} = process.env

const isProduction = NODE_ENV === 'production'

module.exports = withTM(['@tldraw/tldraw', '@tldraw/core'])(
  withPWA({
    reactStrictMode: true,
    pwa: {
      disable: !isProduction,
      dest: 'public',
    },
    productionBrowserSourceMaps: true,
    env: {
      NEXT_PUBLIC_COMMIT_SHA: VERCEL_GIT_COMMIT_SHA,
      GA_MEASUREMENT_ID: GA_ID_QUICKPOSE,
      GITHUB_ID,
      GITHUB_API_SECRET,
      DATA_KEY,
    },
    webpack: (config, options) => {
      if (!options.isServer) {
      }

      config.cache = {
        type: 'filesystem',
        compression: 'gzip',
        //cacheLocation: path.resolve('../.cache'),
      }

      config.plugins.push(
        new options.webpack.DefinePlugin({
          'process.env.NEXT_IS_SERVER': JSON.stringify(options.isServer.toString()),
        })
      )

      config.module.rules.push({
        test: /.*packages.*\.js$/,
        use: ['source-map-loader'],
        enforce: 'pre',
      })

      return config
    },
  })
)
