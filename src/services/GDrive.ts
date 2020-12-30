import {promises as fsp}           from 'fs';
import {basename as getBasename}   from 'path';
import {promisify}                 from 'util';
import {IPAddress}                 from '../model/IPAddress'
import GdriveModel                 from 'gdrive-model'
import { Path } from 'jsonfile';

const {readFile} = fsp
const
  {log: logCfg} = require('config'),
  log4js        = require('log4js');


// logs

log4js.configure(logCfg.log4jsConfigs);

var log = log4js.getLogger(logCfg.appName);
log.setLevel(logCfg.level);


/**
 * getParentFolderDetails
 *
 * @desc Retrieves details about the folder into which the file should be saved
 *
 * @alias getParentFolderDetails
 *
 * @returns {Promise<string>} id - of the folder
 */
async function getParentFolderId({folderName, g}:
{
  folderName: string,
  g: GdriveModel
}): Promise<string> {

  const freetextSearch = `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  log.info(`drive: Getting folder id with search query: ${freetextSearch}`);

  const listFiles = promisify(g.listFiles).bind(g)
  const folderRes: {id: string}[] = await listFiles({
    freetextSearch: freetextSearch,
    spaces: 'drive',
    retFields: ['files(id)']
  })

  if (folderRes.length != 1) {
    const errMsg = 'drive: did not receive exactly one parent folder'
    log.error(errMsg)
    log.error(JSON.stringify(folderRes))
    throw new Error (errMsg)
  }

  const [{id}] = folderRes
  log.info(`drive: Got folder id ${id}`)

  if (!id) {
    throw new Error(`drive: Did not get an id. Full result is ${JSON.stringify(folderRes)}`)
  }

  return id
}

interface iUploaderTrackerReportArgs {
  ips: {
    new : {
      internal: IPAddress,
      external: IPAddress
    },
    old: {
      internal: IPAddress,
      external: IPAddress
    }
  },
  drive: {
    auth: {
      googleScopes: string[],
      tokenFile: Path,
      tokenDir: Path,
      clientSecretFile: Path
    },
    folderName: string
  },
  templateFile: string,
  appName: string
}
/**
 * uploadTrackerReport
 *
 * @desc Uploads the specified payslip to google drive
 *
 *
 * @alias uploadTrackerReport
 *
 * @returns {Promise<string>} driveFileUrl - The google drive file url
 */
async function uploadTrackerReport({ips, drive, templateFile, appName} : iUploaderTrackerReportArgs) : Promise<string> {


  const fn = "uploadTrackerReport"
  log.info (`${fn}: Writing to google drive...`)

  // Update google drive
  // Create the drive object
  var g = new GdriveModel(drive.auth);

  const folderId: string = await getParentFolderId({folderName: drive.folderName, g:g})
  .catch((e)=> {
    const msg = `${fn}: Unable to get parent folder ID: ${e}`
    log.error(msg)
    throw new Error(msg)
  })

  // Upload the file
  log.info('drive: Uploading iptracker file...');

  // Pull up the template
  const contents = await readFile(templateFile,'utf-8')
  // Replace the content to drop in the new IP
  const hydratedContents = contents.replace(/NEW_EXT_IP/g, ips.new.external.toString());
  
  const createFile = promisify(g.createFile).bind(g)
  const {webViewLink: url}: {webViewLink: string} = await createFile({
    media: {
      body: hydratedContents
    },
    resource: {
      description: 'File uploaded by ' + appName ,
      mimeType: 'text/plain',
      parents: [{id: folderId}],
      title: getBasename(templateFile)
    },
    retFields: ['webViewLink']
  })
  .catch((e)=> {
    const msg = `${fn}: Unable to upload iptracker file: ${e}`
    log.error(msg)
    throw new Error(msg)
  })

  log.info('drive: iptracker file uploaded to ' + url)
  return url
 
}



export {uploadTrackerReport, iUploaderTrackerReportArgs}
