'use strict'

import {promises as fsPromises} from 'fs'
import {createStubStoreFile, stubExtIpService, stubIntIpService} from './utils/IPService'
import {createGDriveFolder, getGDriveFile, getGDriveFolderId, trashGDriveFolder, GDriveModel} from './utils/GDrive'
import {writeFile} from 'jsonfile'
import {getIPStoreFile} from './utils/misc'
import {promisify} from 'util'
//import GDriveModel from 'gdrive-model'

const {unlink: deleteFile} = fsPromises

const
  cfg          = require('config'),
  chai         = require('chai'),
  Q            = require('q'),
  rewire       = require('rewire'),
  sinon        = require('sinon'),
  ipTracker    = rewire('../../lib/iptracker.js'),
  EmailNotification = require('email-notification')

/*
 * Set up chai
 */
chai.should();

/*
 * Some utility functions
 */



/**
 * cleanup
 * @desc Clean up various things after running a test suite (e.g. store file, email, etc)
 *
 * @param {object}  params
 * @param {boolean} params.ipStoreFile - clean up the ipStoreFile
 */
async function doCleanup ({
  ipStoreFile = false,
  gdriveFolderId = false,
  gdrive = null
}:{
  ipStoreFile: false | string,
  gdriveFolderId: false | string,
  gdrive: null | GDriveModel
}): Promise<void> {

  await Promise.all([
    (ipStoreFile)?    deleteFile(ipStoreFile) : null,
    (gdriveFolderId)? trashGDriveFolder({folderId: gdriveFolderId, gdrive: gdrive}) : null
  ])
  .catch((err) => {
    if (err.code != "ENOENT") console.error(err);
  })

}



const recipientGdrive = new GDriveModel({
  googleScopes        : cfg.drive.scopes,
  clientSecretFile    : cfg.auth.clientSecretFile,
  tokenDir            : cfg.auth.tokenFileDir,
  tokenFile           : cfg.auth.tokenFile,
  userId              : "me"
});


const enConfig = {
  gmailSearchCriteria: `is:inbox is:unread from:${cfg.reporter.emailsFrom} subject:"%SUBJECT%"`,
  format: 'minimal',
  gmail: {
    clientSecretFile : cfg.auth.clientSecretFile,
    googleScopes     : cfg.auth.googleScopes,
    name             : 'Notification finder',
    tokenDir         : cfg.auth.tokenFileDir,
    tokenFile        : cfg.auth.tokenFile,
    userId : 'me'
  },
  maxResults: 1,
  retFields: 'id',
  metadataHeaders: [],
  processedLabelName: null,
  processedLabelId: null,
}

const enNotification = new EmailNotification(
  Object.assign({}, enConfig, {
    gmailSearchCriteria: enConfig.gmailSearchCriteria.replace('%SUBJECT%', `${cfg.appName} Report`)
  })
);
const notificationHasBeenReceived = promisify(enNotification.hasBeenReceived)

const enError = new EmailNotification(
  Object.assign( {}, enConfig, {
    gmailSearchCriteria: enConfig.gmailSearchCriteria.replace('%SUBJECT%', `${cfg.appName} ERROR`)
  })
);
const errorHasBeenReceived = promisify(enError.hasBeenReceived)





const
  timeout = cfg.testTimeout,
  genericIntIPOld = '111.111.111.111',
  genericIntIPNew = '111.111.111.222',
  genericExtIPOld = '222.222.222.111',
  genericExtIPNew = '222.222.222.222'

