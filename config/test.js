var cfg   = require('config');
var defer = require('config/defer').deferConfig;

module.exports = {
  appName: "ipTracker-test",

  auth: {
    credentialsDir:   `${process.env.HOME}/.credentials`,
    clientSecretFile: defer( function (cfg) { return `${cfg.auth.credentialsDir}/client_secret.json` } ),
    tokenFileDir:     defer( function (cfg) { return cfg.auth.credentialsDir } ),
    tokenFile:        defer( function (cfg) {
      const ret = 'access_token_'
        + cfg.appName
        + (process.env.NODE_ENV && process.env.NODE_ENV != 'production')? `-${process.env.NODE_ENV}` : ""
        + '.json'
      return ret
    }),
    googleScopes: ['https://mail.google.com']
  },

  drive: {
    templateFile: "test/data/driveTemplateFile.txt"
  },

  ipStoreFile: ".last_ip_test.json",

  log : {
    level: "DEBUG",
    log4jsConfigs: {
      replaceConsole: false
    }
  },

  testTimeout: (1000 * 30)

}
