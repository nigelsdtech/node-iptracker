var
  cfg            = require('config'),
  fs             = require('fs'),
  log4js         = require('log4js'),
  reporter       = require('reporter'),
  request        = require('request');



/*
* Get the current IP, check it against the stored one, and email
* an update if it has changed
*
*/


module.exports = function () {


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


  /*
   * Tidy error handler
   */
  function handleError(errMsg) {
    log.error(errMsg)
    reporter.handleError({errMsg: errMsg})
  }


  /*
   * Main program
   */


  log.info('Begin script');
  log.info('============');


  request({
    json: true,
    method: "GET",
    uri: cfg.ipservice
  }, function (err, resp, body) {

    if (err) {
      handleError("Error contacting IP service: " + err)
      return
    }

    var thisIP = body.ip

    log.info('Received IP: ' + thisIP)


    // Compare to what we have locally
    var lastIP
    try {
      lastIP = fs.readFileSync(cfg.ipStoreFile,'utf8')
    } catch (err) {
      log.info('File doesn\'t exist. Creating it. Error was: ' + err);
      lastIP = -1
    }


    // We have a new IP. Update the store file and send out a notification
    if (lastIP != thisIP) {

      log.info ('Old IP was %s. Saving and notifying new IP address.', lastIP)

      // Store to the file
      fs.writeFile(cfg.ipStoreFile, thisIP, {encoding: 'utf8'}, function (err) {
        if (err) {
          handleError("Error saving IP address: " + err)
          return
        }
      })

      // Send it out to the listener
      reporter.sendCompletionNotice({
        body: thisIP
      })

    } else {
      log.info ('No change in IP')
    }


  })

}
