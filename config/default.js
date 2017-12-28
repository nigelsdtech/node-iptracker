var cfg   = require('config');
var defer = require('config/defer').deferConfig;

module.exports = {

  appName: "ipTracker",

  auth: {
    credentialsDir:   process.env.HOME+"/.credentials",
    clientSecretFile: defer( function (cfg) { return cfg.auth.credentialsDir+"/client_secret.json" } ),
    tokenFileDir:     defer( function (cfg) { return cfg.auth.credentialsDir } ),
    tokenFile:        defer( function (cfg) { return "access_token_"+cfg.appName+".json" } ),
    scopes:           defer( function (cfg) { return cfg.drive.scopes } )
  },

  drive: {
    scopes: ['https://www.googleapis.com/auth/drive'],
    folderName: 'iptracker',
    templateFile: 'OVERRIDE_ME_WITH_A_PATH_TO_A_LOCAL_FILE'
  },

  ipStoreFile: ".last_ip.json",

  ipService: "http://ifconfig.co",

  log: {
    appName: defer(function (cfg) { return cfg.appName } ),
    level:   "INFO",
    log4jsConfigs: {
      appenders: [
        {
          type:       "file",
          filename:   defer(function (cfg) { return cfg.log.logDir.concat("/" , cfg.appName , ".log" ) }),
          category:   defer(function (cfg) { return cfg.log.appName }),
          reloadSecs: 60,
          maxLogSize: 1024000
        },
        {
          type: "console"
        }
      ],
      replaceConsole: true
    },
    logDir: "./logs"
  },

  reporter: {
    appName             : defer( function (cfg) { return cfg.appName } ),
    appSpecificPassword : "OVERRIDE_ME",
    emailsFrom          : "OVERRIDE_ME",
    name                : "Reporter (Personal)",
    notificationTo      : "OVERRIDE_ME",
    user                : "OVERRIDE_ME",
    clientSecretFile    : "",
    googleScopes        : "",
    tokenDir            : "",
    tokenFile           : ""
  }

}
