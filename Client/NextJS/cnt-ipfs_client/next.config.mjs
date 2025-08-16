import webpack from 'webpack';

const nextConfig = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: 'crypto-browserify',
        stream: 'stream-browserify',
        url: 'url',
        zlib: 'browserify-zlib',
        http: 'stream-http',
        https: 'https-browserify',
        assert: 'assert',
        os: 'os-browserify/browser',
        path: 'path-browserify',
        process: 'process/browser',
        buffer: 'buffer',
      };

      config.resolve.alias = {
        ...config.resolve.alias,
        process: 'process/browser',
        stream: 'stream-browserify',
        zlib: 'browserify-zlib',
      };
    }

    config.plugins.push(
      new webpack.ProvidePlugin({
        process: 'process/browser',
        Buffer: ['buffer', 'Buffer'],
      })
    );

    config.module.rules.push({
      test: /\.wasm$/,
      type: 'webassembly/async',
    });

    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      topLevelAwait: true,
      layers: true,
    };

    return config;
  },
  swcMinify: false,
  experimental: {
    esmExternals: 'loose',
  },
};

export default nextConfig;