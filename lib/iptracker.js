var
  cfg            = require('config'),
  ifconfig       = require('ifconfig-linux'),
  jsonFile       = require('jsonfile'),
  log4js         = require('log4js'),
  Q              = require('q'),
  reporter       = require('reporter'),
  request        = require('request');


/*
 * Initialize
 */


// logs

log4js.configure(cfg.log.log4jsConfigs);

var log = log4js.getLogger(cfg.log.appName);
log.setLevel(cfg.log.level);


/*
 * Job reporter
 */
reporter.configure(cfg.reporter);



/**
 * handleError
 * @desc Tidy error handler that prints and emails out an error
 *
 * @param {string} errMsg - The error
 */
function handleError(errMsg) {
  log.error(errMsg)
  reporter.handleError({errMsg: errMsg})
}


/**
 * getExternalIP
 * @desc gets the external IP address of the device
 *
 * @param {object}   params (currently unused)
 * @param {function} cb - a callback of one of the following forms:
 *                        cb(err)
 *                        cb(null, {string} extIP)
 *
 */
function getExternalIP (params, cb) {

  request({
    json: true,
    method: "GET",
    uri: cfg.ipservice
  }, function (err, resp, body) {

    if (err) {
      cb("getExternalIP - Error contacting IP service: " + err)
      return
    }

    var extIP = body.ip

    log.debug('getExternalIP - Got: %s', extIP)

    cb(null, extIP)
  })

}

/**
 * getInternalIP
 * @desc gets the internal IP address of the device
 *
 * @param {object}   params (currently unused)
 * @param {function} cb - a callback of one of the following forms:
 *                        cb(err)
 *                        cb(null, {string} intIP)
 *
 */
function getInternalIP (params, cb) {

  var promise = ifconfig()
  promise.then(function (ifconfigData) {

    var intIP = ifconfigData.eth0.inet.addr
    log.debug('getInternalIP - Got: %s', intIP)
    cb(null, intIP)

  })
  .catch( function(err) {
    cb('getInternalIP error: ' + err)
  })
  .done()
}

/**
 * getOldIPs
 * @desc Loads previously stored IPs
 *
 * @param {object}   params (currently unused)
 * @param {function} cb - a callback of one of the following forms:
 *                        cb(err)
 *                        cb(null, {external : "the external IP", internal: "the internal IP"} )
 *
 */
function getOldIPs (params, cb) {

  var file = cfg.IPStoreFile

  log.debug('getOldIPs: Getting file ' + file)

  jsonFile.readFile(file, function(err, oldIPs) {

    if (err) {

      if (err.code == "ENOENT") {
        // The file doesn't exist. Just set dummy values for now
        log.info('Old IP file doesn\'t exist')
        oldIPs = {
          external: "-1",
          internal: "-1"
        }

      } else {
        cb('Error loading old IPs: ' + err)
        return
      }
    }

    log.debug('getOldIPs: Old IPs: ' + JSON.stringify(oldIPs))
    cb(null,oldIPs)
  })

}







module.exports = function () {



  /*
   * Main program
   *
   * Get the current IP, check it against the stored one, and email
   * an update if it has changed
   */

  log.info('Begin script');
  log.info('============');


  Q.all([
    Q.nfcall(getExternalIP, null),
    Q.nfcall(getInternalIP, null),
    Q.nfcall(getOldIPs, null)
  ])
  .spread (function (extIP, intIP, oldIPs) {

    log.info ('IPs: Old %s, Ext - %s, Int - %s', JSON.stringify(oldIPs), extIP, intIP)

    var changes = false

    if (extIP != oldIPs.external) {
      changes = true
      log.info ('External IP has changed')
    }
    if (intIP != oldIPs.internal) {
      changes = true
      log.info ('Internal IP has changed')
    }

    if (changes) {

      var newIPs = {external: extIP, internal: intIP}

      // Store to the file
      log.info('Writing to file...')
      jsonFile.writeFile(cfg.IPStoreFile, newIPs , function (err) {
        if (err) {
          throw new Error ("Error saving IP address: " + err)
        }
        log.info('Written to file')
      })


      var emailBody = "New details - " + JSON.stringify(newIPs)
      emailBody    += "<p>"
      emailBody    += "Old details - " + JSON.stringify(oldIPs)
      // Send it out to the listener
      log.info('Sending completion notice')
      reporter.sendCompletionNotice({
        body: emailBody
      })

    } else {
      log.info ('No change in IP')
    }

  })
  .catch (function (err) {
    handleError(err)
  })
  .done();



}
