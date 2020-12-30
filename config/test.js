var cfg   = require('config');
var defer = require('config/defer').deferConfig;

module.exports = {

  auth: {
    credentialsDir:   `${process.env.HOME}/.credentials`,
    clientSecretFile: defer( function (cfg) { return `${cfg.auth.credentialsDir}/client_secret.json` } ),
    tokenFileDir:     defer( function (cfg) { return cfg.auth.credentialsDir } ),
    tokenFile:        defer( function (cfg) {
      const nenv = process.env.NODE_ENV
      const ret = 'access_token_'.concat(
        cfg.appName,
        (nenv && nenv != 'production')? `-${nenv}` : "",
        '.json'
      )
      return ret
    }),
    googleScopes: ['https://www.googleapis.com/auth/gmail.modify', "https://www.googleapis.com/auth/drive"]
  },

  drive: {
    templateFile: "test/data/driveTemplateFile.txt",
    folderName: defer( function (cfg) {
      const nenv = process.env.NODE_ENV
      const ret = cfg.appName.concat(
        (nenv && nenv != 'production')? `-${nenv}` : "",
      )
      return ret
    })
  },

  ipStoreFile: ".last_ip_test.json",

  log : {
    level: "DEBUG",
    log4jsConfigs: {
      replaceConsole: false
    }
  },

  testTimeout: (1000 * 30),

  reporter: {
    clientSecretFile    : defer( function (cfg) { return cfg.auth.clientSecretFile } ),
    googleScopes        : defer( function (cfg) { return cfg.auth.scopes } ),
    tokenDir            : defer( function (cfg) { return cfg.auth.tokenFileDir } ),
    tokenFile           : defer( function (cfg) { return cfg.auth.tokenFile } )
  }

}
