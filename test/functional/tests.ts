'use strict'

import { expect } from "chai"
import { SinonStub } from "sinon"

const {promises: fsPromises} = require('fs')
const {createStubStoreFile, stubExtIpService, stubIntIpService, clearStubs} = require('./utils/IPService')
const {createGDriveFolder, getGDriveFile, trashGDriveFolder, GDriveModel} = require('./utils/GDrive')
const {getIPStoreFile} = require('./utils/misc')
const {promisify} = require('util')
const md5 = require('md5')



const {unlink: deleteFile} = fsPromises

const
  cfg          = require('config'),
  chaiTest     = require('chai'),
  rewire       = require('rewire'),
  ipTracker    = rewire('../../src/main.ts'),
  EmailNotification = require('email-notification')

/*
 * Set up chai
 */
chaiTest.should();

/*
 * Some utility functions
 */


const recipientGdrive = new GDriveModel({
  googleScopes        : cfg.auth.googleScopes,
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
const checkNotificationHasBeenReceived = promisify(enNotification.hasBeenReceived).bind(enNotification)
const trashNotification = promisify(enNotification.trash).bind(enNotification)

const enError = new EmailNotification(
  Object.assign( {}, enConfig, {
    gmailSearchCriteria: enConfig.gmailSearchCriteria.replace('%SUBJECT%', `${cfg.appName} ERROR`)
  })
);
const checkErrorHasBeenReceived = promisify(enError.hasBeenReceived).bind(enError)
const trashError = promisify(enError.trash).bind(enError)




const
  artificialDelay = 5*1000,
  genericIntIPOld = '111.111.111.111',
  genericIntIPNew = '111.111.111.222',
  genericExtIPOld = '222.222.222.111',
  genericExtIPNew = '222.222.222.222',
  wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));




describe.only("A basic success case", () => {

  const outcomes: {
    folderId?: string
    intIPStub?: SinonStub
    notificationHasBeenReceived?: boolean
    errorHasBeenReceived?: boolean
  } = {}

  before (async () => {

    await Promise.all([

      // Create a test folder
      await createGDriveFolder({
        appName: cfg.appName,
        folderName: `${cfg.drive.folderName}`,
        gdrive: recipientGdrive
      }),

      // Create the local contents file
      await createStubStoreFile({
        ipStoreFile: cfg.ipStoreFile,
        contents: {
          internal: genericIntIPOld,
          external: genericExtIPOld
        }
      })


    ]).then (([folderId, junk]) => {

      outcomes.folderId = folderId
      console.log(`Created a test folder ${cfg.drive.folderName} with id ${outcomes.folderId}`)

    })
        
    stubExtIpService({
      ipService: cfg.ipService,
      responseBody: {
        ip: genericExtIPNew
      }
    })

    outcomes.intIPStub = stubIntIpService({
      ip: genericIntIPNew,
    })

    // Run the test
    await ipTracker()

    // Wait an artifical amount of time
    await wait(artificialDelay)

  })

  // Check the notification has been received
  it("Sends an notification email", async () => {
    outcomes.notificationHasBeenReceived = await checkNotificationHasBeenReceived(null)
    outcomes.notificationHasBeenReceived.should.eql(true)
  })

  it("Does not send an error email", async () => {
    outcomes.errorHasBeenReceived = await checkErrorHasBeenReceived(null)
    outcomes.errorHasBeenReceived.should.eql(false)
  })
  
  // Check the gdrive file is uploaded
  it("Uploads the template file to gdrive", async () => {
    const retFile: Object | null = await getGDriveFile({
      parentFolderId: outcomes.folderId,
      fileName: cfg.drive.templateFile,
      gdrive: recipientGdrive,
      retFields: ['files(md5Checksum)']
    })

    expect(retFile).to.not.eql(null)
    if (retFile) {
      const expectedMd5 = md5(`This is the external IP: ${genericExtIPNew}`)
      retFile.should.have.property('md5Checksum', expectedMd5)
    }
    
  })
  
  // Check the contents of the IP store file at the end
  it("Saves the new details to the IP Store file", async () => {
    const contents = await getIPStoreFile({fileName: cfg.ipStoreFile})
    
    contents.should.eql({
      internal: genericIntIPNew,
      external: genericExtIPNew,
    })
  })

  after (async () => {

    // Clear nock stubs
    clearStubs()
    if (outcomes.intIPStub) {
      outcomes.intIPStub.restore()
    }

    // Delete the test folder
    const testFolderPromise = (outcomes.folderId)? trashGDriveFolder({ folderId: outcomes.folderId, gdrive: recipientGdrive}) : Promise.resolve();

    // Delete the local contents file
    const contentsFilePromise = deleteFile(cfg.ipStoreFile)

    // Delete the emails
    const notificationPromise = (outcomes.notificationHasBeenReceived)? trashNotification(null) : Promise.resolve();
    const errorPromise        = (outcomes.errorHasBeenReceived)?        trashError(null) : Promise.resolve();

    await Promise.all([testFolderPromise, contentsFilePromise, notificationPromise, errorPromise])

  })
})