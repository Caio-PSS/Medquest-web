module.exports = {
    webpack: {
      configure: (webpackConfig) => {
        webpackConfig.module.rules = webpackConfig.module.rules.map(rule => {
          if (rule.oneOf) {
            rule.oneOf = rule.oneOf.map(loader => {
              if (loader.loader && loader.loader.includes('source-map-loader')) {
                loader.exclude = [/node_modules\/react-datepicker/];
              }
              return loader;
            });
          }
          return rule;
        });
        return webpackConfig;
      }
    }
  };