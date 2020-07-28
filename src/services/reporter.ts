import reporter    from 'reporter'
import {IPAddress} from '../model/IPAddress'
import {promisify} from 'util'


const 
    cfg    = require('config'),
    log4js = require('log4js');

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
 * handleError
 * @desc Clean way to log out and report on errors
 *
 * @param {object} params
 * @param {string} params.errMsg - the message to be logged and emailed out
 *
 */
async function handleError ({err}: { err: Error }) : Promise<void> {

    log.error(`handleError - ${err.message}`)
    log.error(`handleError - ${err.stack}`)

    try {
        const he = promisify (reporter.handleError)
        await he ({errMsg: err.message})
    } catch (err) {
        log.error('handleError - failed to send error report: ' + err)
    }

}

interface iCompletionNoticeArgs {
  ips: {
    new: {
      external: IPAddress,
      internal: IPAddress
    },
    old: {
      external: IPAddress,
      internal: IPAddress
    }
  },
  driveFileUrl: string
}

/**
 * sendCompletionNotice
 * @desc Sends out a completion notice of the ip changes
 *
 * @param {string} params.driveFileUrl - Link to the google drive upload file
 *
 */
async function sendCompletionNotice (params: iCompletionNoticeArgs) {

    const emailBody =
      "New details - "
      + JSON.stringify({external: params.ips.new.external, internal: params.ips.new.internal})
      + "<p>"
      + "Old details - "
      + JSON.stringify({external: params.ips.old.external, internal: params.ips.old.internal})
      + ((params.driveFileUrl && params.driveFileUrl != "")? `<p> File upload: ${params.driveFileUrl}` : "")

      // Send it out to the listener
     log.info('sendCompletionNotice: Sending...')

      try {
        const scn = promisify(reporter.sendCompletionNotice)
        await scn({
          body: emailBody
        })
      } catch (err) {
        const e = new Error('sendCompletionNotice: Error while sending: ' + err.message)
        await handleError({err: e})
      }

}


export {handleError, sendCompletionNotice, iCompletionNoticeArgs}