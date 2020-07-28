/*
 * Main program
 *
 * Get the current external and internal IPs, check them against the last known ones (stored locally), and email
 * an update if they have changed
 */


import {getInternalIP, getExternalIP}        from './services/IPService'
import {getOldIntIP, getOldExtIP, saveNewIP} from './services/Datastore'
import {uploadTrackerReport}                 from './services/GDrive'
import {sendCompletionNotice, handleError}   from './services/reporter'
import {IPAddress}                           from './model/IPAddress'
import log4js from 'log4js'

const cfg = require('config')

/*
 * Logs
 */
log4js.configure(cfg.log.log4jsConfigs);

var log = log4js.getLogger(cfg.log.appName);
log.setLevel(cfg.log.level);

module.exports = async function () {

  /*
   * Initialize
   */



  await main()


}


/**
 * @description - Check if one of the IPs has changed
 * 
 * @param oldIntIP 
 * @param oldExtIP 
 * @param newIntIP 
 * @param newExtIP 
 */
function hasIPChanged (oldIntIP, oldExtIP, newIntIP, newExtIP): boolean {
  const hasExtIPChanged = (newExtIP != oldExtIP)
  const hasIntIPChanged = (newIntIP != oldIntIP)

  if (!hasExtIPChanged && !hasIntIPChanged) { log.info('No change in IP'); return false;}

  if (hasExtIPChanged) log.info('External IP has changed')
  if (hasIntIPChanged) log.info('Internal IP has changed')

  return true
}


async function main () {

  /*
   *
   * Main program
   *
   */


  try {

    log.info('Begin script');
    log.info('============');

    const {ipStoreFile} = cfg
  
    const [oldIntIP, oldExtIP, newIntIP, newExtIP]: IPAddress[] = await
      Promise.all([
        getOldIntIP({fileName: ipStoreFile}),
        getOldExtIP({fileName: ipStoreFile}),
        getInternalIP(),
        getExternalIP()
      ])
  
    /*
    * Test for changes in the IPs
    */
  
    log.info (`IPs: Internal [old: ${oldIntIP}, new: ${newIntIP}], External [old: ${oldExtIP}, new: ${newExtIP}]`)
  
    const changed: boolean = hasIPChanged(oldIntIP, oldExtIP, newIntIP, newExtIP)
    const isExtIPChanged = (newExtIP != oldExtIP)
    const isIntIPChanged = (newIntIP != oldIntIP)

    if (!isExtIPChanged && !isIntIPChanged) { log.info('No change in IP'); return;}

    if (isExtIPChanged) log.info('External IP has changed')
    if (isIntIPChanged) log.info('Internal IP has changed')  
  
    const ips = {
      old: {
        external: oldExtIP,
        internal: oldIntIP
      },
      new: {
        external: newExtIP,
        internal: newIntIP
      }
    }

    const {googleScopes, tokenFile, tokenDir, clientSecretFile} = cfg.auth
    const {folderName, templateFile} = cfg.drive

    // Upload to drive
    const driveFileUrl = await uploadTrackerReport({
      ips: ips,
      drive: {
        auth: {
          googleScopes: googleScopes,
          tokenFile: tokenFile,
          tokenDir: tokenDir,
          clientSecretFile: clientSecretFile
        },
        folderName: folderName
      },
      templateFile: templateFile,
      appName: cfg.appName
    })


    // Save to file
    await saveNewIP({contents: ips.new, fileName: ipStoreFile}),
  
    /*
    * Send a completion notice email
    */
    await sendCompletionNotice({
      ips: ips,
      driveFileUrl: driveFileUrl
    })

  } catch (err) {
    handleError({err: err})
  }


}

