'use strict'

var
  cfg          = require('config'),
  chai         = require('chai'),
  fs           = require('fs'),
  gdriveModel  = require('gdrive-model'),
  jsonFile     = require('jsonfile'),
  nock         = require('nock'),
  path         = require('path'),
  Q            = require('q'),
  rewire       = require('rewire'),
  sinon        = require('sinon'),
  ipTracker    = rewire('../../lib/iptracker.js')

/*
 * Set up chai
 */
chai.should();



var timeout = (1000*10)


/*
 * Some stubs
 */

var serviceStubExtIP = "999.99.9.99"
var serviceStubIntIP = "88.8.8.88"
var genericOldExtIP  = "1.2.3.4"
var genericOldIntIP  = "5.6.7.8"


/*
 * Stubbed external IP service
 */
function stubExtIpService (params) {

  if (!params) params = {}
  if (!params.response) params.response = {}
  if (!params.response.statusCode) params.response.statusCode = 200
  if (!params.response.body) params.response.body = {
    "ip": serviceStubExtIP,
    "ip_decimal":123456789,
    "country":"Fictionland",
    "city":"OfFiction",
    "hostname":"fiction.test.com"
  }

  var ret = nock(cfg.ipService, {
    reqheaders: {
      'Accept': 'application/json'
    }
  })
  .get("/")

  if (params.replyWithError) return ret.replyWithError(params.replyWithError)

  return ret.reply(params.response.statusCode, params.response.body)
}

/*
 * Stubbed internal IP service
 */
function stubIntIpService (params) {

  if (!params) params = {}
  if (!params.response) params.response = { eth0: { inet: { addr: serviceStubIntIP } } }

  var retFn = function (p,cb) {return Q.resolve(params.response)}
  if (params.replyWithError) { retFn = function (p,cb) { return Q.reject(params.replyWithError) } }

  var ipTrackerRewire = ipTracker.__set__('ifconfig', retFn)
}




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
function cleanup (params,cb) {

  var jobs = []

  if (!params) { params = {} }

  // Clean up the ipStoreFile
  if (!params.hasOwnProperty('ipStoreFile') || params.ipStoreFile) { jobs.push(Q.nfcall(fs.unlink, cfg.ipStoreFile)) }

  // Clean up Google drive file
  if (params.hasOwnProperty('gdriveFolderId')) { jobs.push(Q.nfcall(trashTestGDriveFolder, {folderId: params.gdriveFolderId})) }

  // Clean up google drive

  Q.all(jobs)
  .catch( function (err) {
    if (!err.code == "ENOENT") console.error(err);
  })
  .done(function () { cb() })

}

/**
 * createStubStoreFile
 * @desc Create a generic stub store file
 *
 * @param {object}  params
 * @param {boolean} params.ext - external IP in the file
 * @param {boolean} params.int - internal IP in the file
 */
function createStubStoreFile (params,cb) {

  // Create a store file with the stub IP
  jsonFile.writeFile(cfg.ipStoreFile, {
    external: params.external,
    internal: params.internal
  }, function(err) {
    if (err) throw new Error ('createStubStoreFile error: ' + err)
    cb()
  });

}



var personalGdrive = new gdriveModel({
  googleScopes        : cfg.drive.scopes,
  clientSecretFile    : cfg.auth.clientSecretFile,
  tokenDir            : cfg.auth.tokenFileDir,
  tokenFile           : cfg.auth.tokenFile
});

/**
 * createTestGDriveFolder
 * @desc Create a temp google drive folder for test purposes
 *
 * @param {object}  params - currently unused
 *
 * @returns cb(err, folder) where folder is the google drive object representing the folder
 */
function createTestGDriveFolder (params,cb) {

  var d = new Date();
  var desc =  "Test folder created by " + cfg.appName + " on " + d.toString();
  var title = cfg.drive.folderName;

  personalGdrive.createFile ({
    isFolder : true,
    resource: {
      description: desc,
      title: title
    }
  }, function (err, folder) {
    if (err) { cb(err); return null; }
    cb(null,folder);
  })

}

/**
 * testCompletionNotice
 * @desc Tests a completion notice contents
 *
 * @param {object}  params
 * @param {object}  params.completionNoticeSpy - The sinon spy that's been used to stub the completion notice emailer
 * @param {boolean} params.isCompletionNoticeExpected
 * @param {object}  params.ips -
 * @param {object}  params.ips.new
 * @param {string}  params.ips.new.external
 * @param {string}  params.ips.new.internal
 * @param {object}  params.ips.old
 * @param {string}  params.ips.old.external
 * @param {string}  params.ips.old.internal
 * @param {boolean} params.webViewLink
 *
 * @returns nothing
 */
function testCompletionNotce (params,cb) {

  if (params.isCompletionNoticeExpected) {
    var emailBody = 'New details - {"external":"' + params.ips.new.external + '","internal":"' + params.ips.new.internal + '"}'
    emailBody    += '<p>'
    emailBody    += 'Old details - {"external":"' + params.ips.old.external + '","internal":"' + params.ips.old.internal + '"}'
    emailBody    += '<p>'
    emailBody    += 'File upload: ' + params.webViewLink

    var completionNoticeArgs = {
      body: emailBody
    }
    params.completionNoticeSpy.getCall(0).args[0].should.deep.equal(completionNoticeArgs)
    params.completionNoticeSpy.callCount.should.equal(1)

  } else {
    params.completionNoticeSpy.callCount.should.equal(0)
  }

}

/**
 * testGDriveReport
 * @desc Tests a file that has been uploaded to google drive
 *
 * @param {object}  params
 * @param {string}  params.gdriveFileObj    - Object reference to a gdriveFile allowing you to change something about the original object
 *                                            (currently used to pass the webViewLink up and down)
 * @param {string}  params.gdriveFolderId   - id of the parent folder
 * @param {boolean} params.isUploadExpected - true if you were expecting a file to have been uploaded
 * @param {string}  cb - callback
 *
 * @returns cb() - no arguments
 * @throws - an error if there was a problem connecting to gdrive
 */
function testGdriveReport (params,cb) {

  personalGdrive.listFiles({
    freetextSearch: '"' + params.gdriveFolderId + '" in parents and name = "' + path.basename(cfg.drive.templateFile) + '"',
    spaces: "drive",
    retFields: ['files(mimeType,size,webViewLink)']
  }, function (err, retFiles) {

    if (err) throw err

    if (params.isUploadExpected) {
      retFiles[0].mimeType.should.equal('text/plain')
      retFiles[0].size.should.not.equal('0')
      params.gdriveFileObj.webViewLink = retFiles[0].webViewLink
      retFiles.length.should.equal(1);
    } else {
      retFiles.length.should.equal(0);
    }

    cb();
  });
}

/**
 * trashTestGDriveFolder
 * @desc Trash a temp google drive folder for test purposes
 *
 * @param {object}  params - currently unused
 * @param {string}  params.folderId - ID of the folder to be deleted
 *
 * @returns cb(err)
 */
function trashTestGDriveFolder (params,cb) {

  personalGdrive.trashFiles ({
    fileIds: [params.folderId],
    deletePermanently: true
  }, function (err, folder) {
    if (err) { cb(err); return null; }
    cb(null,folder);
  })

}





/*
 * The tests
 */

var testCases = [
  { describe: "Running the script when only the external IP has changed",
  it: "leaves the last_ip file with the latest known IPs",
  oldIPStoreContents: {external:genericOldExtIP,  internal: serviceStubIntIP},
  newIPStoreContents: {external:serviceStubExtIP, internal: serviceStubIntIP}},

  { describe: "Running the script when only the internal IP has changed",
  it: "leaves the last_ip file with the latest known IPs",
  oldIPStoreContents: {external:serviceStubExtIP, internal: genericOldIntIP},
  newIPStoreContents: {external:serviceStubExtIP, internal: serviceStubIntIP}},

  { describe: "Running the script when both the external and internal IPs have changed",
  it: "leaves the last_ip file with the latest known IPs",
  oldIPStoreContents: {external:genericOldExtIP,  internal: genericOldIntIP},
  newIPStoreContents: {external:serviceStubExtIP, internal: serviceStubIntIP}},

  { describe: "Running the script when no ips have changed",
  only: true,
  it: "leaves the last_ip file with the latest known ips",
  oldIPStoreContents: {external:serviceStubExtIP, internal: serviceStubIntIP},
  newIPStoreContents: {external:serviceStubExtIP, internal: serviceStubIntIP},
  storeFileExistsAtStartOverrides: {
    yes : { isCompletionNoticeExpected: false }}},


  { describe: "Running the script when the external IP service returns a bad response",
  it: "does not update the last_ip file",
  extIpServiceStub: {
    response: {
      body: "Service Unavailable",
      statusCode: 500 }},
  oldIPStoreContents: {external:genericOldExtIP, internal: genericOldIntIP},
  newIPStoreContents: {external:genericOldExtIP, internal: genericOldIntIP},
  isCompletionNoticeExpected: false,
  isErrorNoticeExpected: true,
  storeFileExistsAtStartOverrides: {
    no : {
      checkIPStoreOnCompletion: false,
      IPStoreExistsOnCompletion: false }}},

  { describe: "Running the script when the external IP service request fails",
  it: "does not update the last_ip file",
  extIpServiceStub: {
    replyWithError: "simulated failure" },
  oldIPStoreContents: {external:genericOldExtIP, internal: genericOldIntIP},
  newIPStoreContents: {external:genericOldExtIP, internal: genericOldIntIP},
  isCompletionNoticeExpected: false,
  isErrorNoticeExpected: true,
  storeFileExistsAtStartOverrides: {
    no : {
      checkIPStoreOnCompletion: false,
      IPStoreExistsOnCompletion: false }}},

  { describe: "Running the script when the internal IP service fails",
  it: "does not update the last_ip file",
  intIpServiceStub: {
    replyWithError: "simulated failure" },
  oldIPStoreContents: {external:genericOldExtIP, internal: genericOldIntIP},
  newIPStoreContents: {external:genericOldExtIP, internal: genericOldIntIP},
  isCompletionNoticeExpected: false,
  isErrorNoticeExpected: true,
  storeFileExistsAtStartOverrides: {
    no : {
      checkIPStoreOnCompletion: false,
      IPStoreExistsOnCompletion: false }}},

  { describe: "Running the script when the internal IP service doesn't return eth0",
  it: "does not update the last_ip file",
  intIpServiceStub: {
    response: { malformed_response: [] } },
  oldIPStoreContents: {external:genericOldExtIP, internal: genericOldIntIP},
  newIPStoreContents: {external:genericOldExtIP, internal: genericOldIntIP},
  isCompletionNoticeExpected: false,
  isErrorNoticeExpected: true,
  storeFileExistsAtStartOverrides: {
    no : {
      checkIPStoreOnCompletion: false,
      IPStoreExistsOnCompletion: false }}}


]



testCases.forEach( (el) => {

  /*
   * Start with the main test case
   */

  var describeFn = describe
  if (el.only) {
    describeFn = describe.only
  }

  describeFn(el.describe, function () {

    var storeFileExistsAtStartStates = el.storeFileExistsAtStartStates || [ true, false ]

    /*
     * Deviate based on whether a last_ip file existed when the script started
     */
    storeFileExistsAtStartStates.forEach( (isStoreFilePresentAtStart) => {


      /*
       * Set up tests specific to this case
       */
      var isCompletionNoticeExpected      = (el.hasOwnProperty('isCompletionNoticeExpected'))?       el.isCompletionNoticeExpected       : true
      var isErrorNoticeExpected           = (el.hasOwnProperty('isErrorNoticeExpected'))?            el.isErrorNoticeExpected            : false
      var checkIPStoreOnCompletion        = (el.hasOwnProperty('checkIPStoreOnCompletion'))?         el.checkIPStoreOnCompletion         : false
      var IPStoreExistsOnCompletion       = (el.hasOwnProperty('IPStoreExistsOnCompletion'))?        el.IPStoreExistsOnCompletion        : true
      var storeFileExistsAtStartOverrides = (el.hasOwnProperty('storeFileExistsAtStartOverrides'))?  el.storeFileExistsAtStartOverrides  : { yes:{}, no: {} }

      storeFileExistsAtStartOverrides.yes = (storeFileExistsAtStartOverrides.hasOwnProperty('yes'))? storeFileExistsAtStartOverrides.yes : {}
      storeFileExistsAtStartOverrides.no  = (storeFileExistsAtStartOverrides.hasOwnProperty('no'))?  storeFileExistsAtStartOverrides.no  : {}



      if (isStoreFilePresentAtStart) {
        isCompletionNoticeExpected  = (storeFileExistsAtStartOverrides.yes.hasOwnProperty('isCompletionNoticeExpected'))? storeFileExistsAtStartOverrides.yes.isCompletionNoticeExpected : isCompletionNoticeExpected
        isErrorNoticeExpected       = (storeFileExistsAtStartOverrides.yes.hasOwnProperty('isErrorNoticeExpected'))?      storeFileExistsAtStartOverrides.yes.isErrorNoticeExpected      : isErrorNoticeExpected
        checkIPStoreOnCompletion    = (storeFileExistsAtStartOverrides.yes.hasOwnProperty('checkIPStoreOnCompletion'))?   storeFileExistsAtStartOverrides.yes.checkIPStoreOnCompletion   : checkIPStoreOnCompletion
      } else {
        isCompletionNoticeExpected  = (storeFileExistsAtStartOverrides.no.hasOwnProperty('isCompletionNoticeExpected'))?  storeFileExistsAtStartOverrides.no.isCompletionNoticeExpected  : isCompletionNoticeExpected
        isErrorNoticeExpected       = (storeFileExistsAtStartOverrides.no.hasOwnProperty('isErrorNoticeExpected'))?       storeFileExistsAtStartOverrides.no.isErrorNoticeExpected       : isErrorNoticeExpected
        checkIPStoreOnCompletion    = (storeFileExistsAtStartOverrides.no.hasOwnProperty('checkIPStoreOnCompletion'))?    storeFileExistsAtStartOverrides.no.checkIPStoreOnCompletion    : checkIPStoreOnCompletion
        IPStoreExistsOnCompletion   = (storeFileExistsAtStartOverrides.no.hasOwnProperty('IPStoreExistsOnCompletion'))?   storeFileExistsAtStartOverrides.no.IPStoreExistsOnCompletion   : IPStoreExistsOnCompletion
      }


      var description = "last_ip store file "
      description    += (isStoreFilePresentAtStart)? "exists": "doesn't exist"
      description    += " at startup"



      /*
       * Here's the sub test based on the last_ip file
       */
      describe(description, function () {

        this.timeout(timeout)


        var completionNoticeSpy = null
        var errorNoticeSpy      = null
        var restore             = null
        var gdriveFolderId      = null

        before( function(done) {

          completionNoticeSpy = sinon.spy();
          errorNoticeSpy      = sinon.spy();

          var extIPServiceStub = stubExtIpService( (el.hasOwnProperty('extIpServiceStub'))? el.extIpServiceStub : null)
          var intIPServiceStub = stubIntIpService( (el.hasOwnProperty('intIpServiceStub'))? el.intIpServiceStub : null)

          restore = ipTracker.__set__('reporter', {
            configure: function () {},
            handleError: errorNoticeSpy,
            sendCompletionNotice: completionNoticeSpy
          })


          var completionJobs = [
            Q.nfcall(createTestGDriveFolder, null)
	  ]

          if (isStoreFilePresentAtStart) {
            completionJobs.push(Q.nfcall(createStubStoreFile,el.oldIPStoreContents))
          }

          Q.all(completionJobs)
          .spread (function (gdriveFolder) {

            gdriveFolderId = gdriveFolder.id
            return Q.nfcall(ipTracker,null)
	  })
          .done(function () {
            done()
          });


        })

        after( function (done) {
          restore()
          cleanup({
            gdriveFolderId: gdriveFolderId
          },done)
        })


        /*
	 * Test for the final value of the ip store file
	 */

        if (checkIPStoreOnCompletion) {
          it(el.it, function(done) {
            jsonFile.readFile(cfg.ipStoreFile, function(err, newIPStoreContents) {
              if (err) throw new Error ('Error loading last_ip file: ' + err)
              newIPStoreContents.external.should.equal(el.newIPStoreContents.external)
              newIPStoreContents.internal.should.equal(el.newIPStoreContents.internal)
              done()
            })
          })
        }


        /*
	 * Test the existence of the IP store on completion
	 */

        if (!IPStoreExistsOnCompletion) {
          it("last_ip store file doesn't exist on completion", function(done) {
            jsonFile.readFile(cfg.ipStoreFile, function(err, newIPStoreContents) {
              err.code.should.equal('ENOENT')
              done()
            })
          })
        }

        /*
         * Test for a completion notice (by email and in gdrive)
         */

        var completionNoticeIt        = "doesn't send a completion notice"
        var completionNoticeCallCount = 0

        var gdriveUploadIt            = "doesn't upload a change report to the google drive"
        var gdriveFileCount           = 0

        var gdriveFile                = {}

        if (isCompletionNoticeExpected) {
          completionNoticeIt = "sends a completion notice with the new and old IP's"
          completionNoticeCallCount = 1

          gdriveUploadIt  = "uploads a change report to the google drive"
          gdriveFileCount = 1
        }

        it(gdriveUploadIt, function(done) {
          testGdriveReport({
            gdriveFolderId: gdriveFolderId,
            isUploadExpected: isCompletionNoticeExpected,
            gdriveFileObj: gdriveFile
	  },function (gdriveFile) {
            done()
	  })
        })


        it(completionNoticeIt, function () {
          testCompletionNotce({
            completionNoticeSpy: completionNoticeSpy,
            isCompletionNoticeExpected: isCompletionNoticeExpected,
            ips : {
              new: el.newIPStoreContents,
              old: (isStoreFilePresentAtStart)? el.oldIPStoreContents : {external: "-1", internal: "-1"}
	    },
            webViewLink: gdriveFile.webViewLink
	  })
	})


        /*
         * Test for an error message
         */

        var errorNoticeIt        = "doesn't send an error notice"
        var errorNoticeCallCount = 0
        if (isErrorNoticeExpected) {
          errorNoticeIt = "sends an error notice"
          errorNoticeCallCount = 1
        }

        it(errorNoticeIt, function () {
          errorNoticeSpy.callCount.should.equal(errorNoticeCallCount)
	})
      })
    })
  })
})





describe("Problems with the last_ip file", function () {

  this.timeout(timeout)


  var completionNoticeSpy = null
  var errorNoticeSpy      = null
  var restoreReporter     = null
  var gdriveFolderId      = null
  var gdriveFile          = {}
  var newIPStoreContents  = {}


  describe("when the last_ip file can't be opened", function () {


    before( function(done) {

      completionNoticeSpy = sinon.spy();
      errorNoticeSpy      = sinon.spy();

      var extIPServiceStub = stubExtIpService(null)
      var intIPServiceStub = stubIntIpService(null)

      restoreReporter = ipTracker.__set__('reporter', {
        configure: function () {},
        handleError: errorNoticeSpy,
        sendCompletionNotice: completionNoticeSpy
      })

      var restoreJsonFile = ipTracker.__set__('jsonFile.readFile', function (file, cb) {
        var err = new Error("Simulated failure")
        cb(err)
      })


      var completionJobs = [
        Q.nfcall(createTestGDriveFolder, null),
        Q.nfcall(createStubStoreFile,{external: genericOldExtIP, internal: genericOldIntIP})
      ]

      Q.all(completionJobs)
      .spread (function (gdriveFolder, empty) {
        gdriveFolderId = gdriveFolder.id
        return Q.nfcall(ipTracker,null)
      })
      .done(function () {
        restoreJsonFile()
        done()
      });

    })

    after( function (done) {
      restoreReporter()
      cleanup({
        gdriveFolderId: gdriveFolderId
      },done)
    })

    /*
     * Test for the final value of the ip store file
     */

    it("creates a new IP store file with the known IPs", function(done) {
      jsonFile.readFile(cfg.ipStoreFile, function(err, ret) {
        if (err) throw new Error ('Error loading last_ip file: ' + err)
        newIPStoreContents = ret
        newIPStoreContents.external.should.equal(serviceStubExtIP)
        newIPStoreContents.internal.should.equal(serviceStubIntIP)
        done()
      })
    })

    /*
     * Test for a completion report upload to gdrive
     */

    it("uploads a change report to the google drive", function (done) {
      testGdriveReport({
        gdriveFolderId: gdriveFolderId,
        isUploadExpected: true,
        gdriveFileObj: gdriveFile
      },function (gdriveFile) {
        done()
      })
    })

    /*
     * Test for a completion notice
     */

    it("sends a completion notice with the new and old IP's", function () {
      testCompletionNotce({
        completionNoticeSpy: completionNoticeSpy,
        isCompletionNoticeExpected: true,
        ips : {
          new: newIPStoreContents,
          old: {external: "-1", internal: "-1"}
        },
        webViewLink: gdriveFile.webViewLink
      })
    })


    /*
     * Test for an error message
     */
    it("sends an error notice", function () {
      errorNoticeSpy.callCount.should.equal(1)
    })

  })



  describe("when the last_ip file can't be written to", function () {


    before( function(done) {

      completionNoticeSpy = sinon.spy();
      errorNoticeSpy      = sinon.spy();

      var extIPServiceStub = stubExtIpService(null)
      var intIPServiceStub = stubIntIpService(null)

      restoreReporter = ipTracker.__set__('reporter', {
        configure: function () {},
        handleError: errorNoticeSpy,
        sendCompletionNotice: completionNoticeSpy
      })



      var restoreJsonFile

      Q.all([
        Q.nfcall(createTestGDriveFolder, null),
        Q.nfcall(createStubStoreFile,{external: genericOldExtIP, internal: genericOldIntIP})
      ])
      .spread (function (gdriveFolder, empty) {

        gdriveFolderId = gdriveFolder.id

        restoreJsonFile = ipTracker.__set__('jsonFile.writeFile', function (file, contents, cb) {
          var err = new Error("Simulated failure")
          cb(err)
        })

        return Q.nfcall(ipTracker,null)
      })
      .done(function () {
        restoreJsonFile()
        done()
      });

    })

    after( function (done) {
      restoreReporter()
      cleanup({
        gdriveFolderId: gdriveFolderId
      },done)
    })


    it("can't trash the old last_ip store file")

    it("trashes the old last_ip store file", function(done) {
      jsonFile.readFile(cfg.ipStoreFile, function(err, newIPStoreContents) {
        err.code.should.equal('ENOENT')
        done()
      })
    })

    /*
     * Test for a completion report upload to gdrive
     */

    it("uploads a change report to the google drive", function(done) {
      testGdriveReport({
        gdriveFolderId: gdriveFolderId,
        isUploadExpected: true,
        gdriveFileObj: gdriveFile
      },function (gdriveFile) {
        done()
      })
    })

    /*
     * Test for a completion notice
     */

    it("sends a completion notice with the new and old IP's", function () {
      testCompletionNotce({
        completionNoticeSpy: completionNoticeSpy,
        isCompletionNoticeExpected: true,
        ips : {
          new: {external: serviceStubExtIP, internal: serviceStubIntIP},
          old: {external: genericOldExtIP,  internal: genericOldIntIP}
        },
        webViewLink: gdriveFile.webViewLink
      })
    })

    /*
     * Test for an error message
     */
    it("sends an error notice", function () {
      errorNoticeSpy.callCount.should.equal(1)
    })


  })

})



describe("Problems with the google drive upload", function () {
    it("google drive can't be reached")
    it("parent folder can't be found")
    it("multiple parent folders found with the same name")
})
