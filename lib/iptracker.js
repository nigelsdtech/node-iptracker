/*
 * Main program
 *
 * Get the current external and internal IPs, check them against the last known ones (stored locally), and email
 * an update if they have changed
 */

var
  cfg            = require('config'),
  GDriveManager  = require('./GDriveManager.js'),
  ifconfig       = require('ifconfig-linux'),
  jsonFile       = require('jsonfile'),
  log4js         = require('log4js'),
  path           = require('path'),
  Q              = require('q'),
  reporter       = require('reporter'),
  request        = require('request');



module.exports = function (programComplete) {

  /*
   * Initialize
   */


  /*
   * Logs
   */
  log4js.configure(cfg.log.log4jsConfigs);

  var log = log4js.getLogger(cfg.log.appName);
  log.setLevel(cfg.log.level);


  /*
   * Job reporter
   */
  reporter.configure(cfg.reporter);


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
      uri: cfg.ipService
    }, function (err, resp, body) {

      if (err || resp.statusCode != 200) {

        if (err) {
          cb("getExternalIP - Error contacting IP service: " + err);
        } else {
          cb("getExternalIP - statusCode: " + resp.statusCode + " -- body: " + body);
	}
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

    var file = cfg.ipStoreFile

    log.debug('getOldIPs: Getting file ' + file)

    jsonFile.readFile(file, function(err, oldIPs) {

      if (err) {

        oldIPs = {
          external: "-1",
          internal: "-1"
        }

        if (err.code == "ENOENT") {
          // The file doesn't exist. Just set dummy values for now
          log.info('Old IP file doesn\'t exist')


        } else {
          handleError({errMsg: "Error loading old IP file: " + err})
        }
      }

      log.debug('getOldIPs: Old IPs: ' + JSON.stringify(oldIPs))
      cb(null,oldIPs)
    })

  }


  /**
   * handleError
   * @desc Clean way to log out and report on errors
   *
   * @param {object} params
   * @param {string} params.errMsg - the message to be logged and emailed out
   *
   */
  function handleError (params, cb) {

    log.error(params.errMsg)

    try {
      reporter.handleError({errMsg: params.errMsg})
    } catch (err) {
      log.error('handleError - failed to send error report: ' + err)
    }

  }

  /**
   * sendCompletionNotice
   * @desc Sends out a completion notice of the ip changes
   *
   * @param {object} params
   * @param {string} params.ips.new.external -
   * @param {string} params.ips.new.internal -
   * @param {string} params.ips.old.external -
   * @param {string} params.ips.old.internal -
   * @param {string} params.driveFileUrl - Link to the google drive upload file
   *
   */
  function sendCompletionNotice (params, cb) {

    var emailBody = "New details - " + JSON.stringify({external: params.ips.new.external, internal: params.ips.new.internal})
    emailBody    += "<p>"
    emailBody    += "Old details - " + JSON.stringify({external: params.ips.old.external, internal: params.ips.old.internal})
    emailBody    += "<p>"
    emailBody    += "File upload: " + params.driveFileUrl

    // Send it out to the listener
    log.info('Sending completion notice')

    try {
      reporter.sendCompletionNotice({
        body: emailBody
      })
    } catch (err) {
      handleError({errMsg: 'Error sending completion notice: ' + err})
    }

  }

  /**
   * updateStoreFile
   * @desc Updates the contents of the store file
   *
   * @param {object} params
   * @param {string} params.external -
   * @param {string} params.internal -
   *
   */
  function updateStoreFile (params, cb) {

    // Store to the file
    log.info('Writing to file...')
    jsonFile.writeFile(cfg.ipStoreFile, {external: params.external, internal: params.internal} , function (err) {
      if (err) {
        handleError({errMsg: "Error writing to IP file: " + err})
        return
      }
      log.info('Written to file')
    })

  }


  /*
   *
   * Main program
   *
   */


  log.info('Begin script');
  log.info('============');


  var driveFileUrl      = ""
  var ips               = {}
  var isChanged         = false
  var updateGoogleDrive = false


  Q.all([
    Q.nfcall(getExternalIP, null),
    Q.nfcall(getInternalIP, null),
    Q.nfcall(getOldIPs, null)
  ])
  .spread (function (newExtIP, newIntIP, oldIPs) {

    log.info ('IPs: Old %s, Ext - %s, Int - %s', JSON.stringify(oldIPs), newExtIP, newIntIP)

    if (newExtIP != oldIPs.external) {
      isChanged = true
      log.info ('External IP has changed')
    }
    if (newIntIP != oldIPs.internal) {
      isChanged = true
      log.info ('Internal IP has changed')
    }

    if (isChanged) {

      ips = {
        old: {
	  external: oldIPs.external,
	  internal: oldIPs.internal
	},
        new: {
	  external: newExtIP,
	  internal: newIntIP
	},
      }

      // Store to the file
      updateStoreFile(ips.new)

      updateGoogleDrive = true

      var uploadTrackerReport = Q.nbind(GDriveManager.uploadTrackerReport, GDriveManager)
      return Q.nfcall(uploadTrackerReport, {ips: ips})

    } else {
      log.info ('No change in IP')
      return Q.resolve()
    }

  })
  .then(function (driveFileUrl) {

    if(updateGoogleDrive) {

      // Update the google drive
      GDriveManager.uploadTrackerReport({ips: ips}, function(err, url){

        if (err) {
          handleError({errMsg: "Error uploading to google drive: " + err})
          // We want to send a completion notice anyway and leave out the report
          driveFileUrl = "Error uploading drive file"
        }

        driveFileUrl = url
        return Q.resolve()

      })
    } else {
      return Q.resolve()
    }


  })
  .then(function () {

    if (isChanged) {
      sendCompletionNotice({
        ips: ips,
        driveFileUrl: driveFileUrl
      })
    }

    return Q.resolve()
  })
  .catch (function (errMsg) {
    handleError({errMsg: errMsg})
  })
  .done(function () {
    if (programComplete) programComplete();
  });



}
