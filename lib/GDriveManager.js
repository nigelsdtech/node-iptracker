"use strict"

var cfg          = require('config'),
    fs           = require('fs'),
    log4js       = require('log4js'),
    GdriveModel  = require('gdrive-model'),
    path         = require('path')


// logs

log4js.configure(cfg.log.log4jsConfigs);

var log = log4js.getLogger(cfg.log.appName);
log.setLevel(cfg.log.level);


/**
 * uploadTrackerReport
 *
 * @desc Uploads the specified payslip to google drive
 *
 *
 * @alias uploadTrackerReport
 *
 * @param {object=}   params - Parameters for request
 * @param {object=}   params.ips - Object of the form {new: {external: ?, internal: ?}, old: {external: ?, internal: ?}}
 * @returns {string} driveFileUrl - The google drive file url
 */
function uploadTrackerReport(params,callback) {

  // Pull up the template
  fs.readFile(cfg.drive.templateFile,'utf-8', function (err, contents) {

    if(err) {
      log.error("drive: Error getting google drive template: " + err)
      return
    }

    // Replace the content to drop in the new IP
    contents = contents.replace(/NEW_EXT_IP/g, params.ips.new.external);

    // Update google drive
    // Create the drive object
    var g = new GdriveModel({
      googleScopes:     cfg.auth.scopes,
      tokenFile:        cfg.auth.tokenFile,
      tokenDir:         cfg.auth.tokenFileDir,
      clientSecretFile: cfg.auth.clientSecretFile
    });

    var freetextSearch = "name='" + cfg.drive.folderName + "' and mimeType = 'application/vnd.google-apps.folder'";
    log.info('drive: Getting folder id with search query: ' + freetextSearch);

    // Get the id of the folder
    g.listFiles({
      freetextSearch: freetextSearch,
      spaces: 'drive',
      retFields: ['files/id', 'files/name']
    }, function (err, results) {

      if (err) { callback(err); return null }

      if (results.length != 1) {
        var errMsg = 'drive: did not receive exactly one parent folder'
        log.error(errMsg)
        log.error(results)
        callback(new Error(errMsg));
        return null
      }

      log.info('drive: Got folder: %s (%s)', results[0].name, results[0].id);
      var parentId = results[0].id

      // Upload the file
      log.info('drive: Uploading iptracker file...');
      g.createFile({
         media: {
           body: contents
         },
         resource: {
           description: 'File uploaded by ' + cfg.appName ,
           mimeType: 'text/plain',
           parents: [{id: parentId}],
           title: path.basename(cfg.drive.templateFile)
         },
         retFields: ['id', 'webViewLink']
      }, function (err, resp) {

        if (err) { callback(err); return null }

        log.info('drive: iptracker file uploaded to ' + resp.webViewLink)
        callback(null,resp.webViewLink)

      })
    })

  })

}


exports.uploadTrackerReport = uploadTrackerReport;
