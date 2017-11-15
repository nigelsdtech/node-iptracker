'use strict'

var
  cfg       = require('config'),
  chai      = require('chai'),
  fs        = require('fs'),
  jsonFile  = require('jsonfile'),
  nock      = require('nock'),
  Q         = require('q'),
  rewire    = require('rewire'),
  sinon     = require('sinon'),
  ipTracker = rewire('../../lib/iptracker.js')

/*
 * Set up chai
 */
chai.should();



var timeout = (1000*60)


/*
 * Some stubs
 */

var serviceStubExtIP = "999.99.9.99"


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
  .get('/')


  if (params.replyWithError) return ret.replyWithError(params.replyWithError)

  return ret.reply(params.response.statusCode, params.response.body)
}


var serviceStubIntIP = "88.8.8.88"
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
  if (!params.hasOwnProperty('ipStoreFile') || params.ipStorFile) { jobs.push(Q.nfcall(fs.unlink, cfg.ipStoreFile)) }

  Q.all(jobs)
  .catch( function (err) {
    if (!err.code == "ENOENT") console.log(err);
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


/*
 * The tests
 */

var testCases = [
  { describe: "Running the script when only the external IP has changed",
  it: "leaves the last_ip file with the latest known IPs",
  oldIPStoreContents: {external:"1.2.3.4",        internal: serviceStubIntIP},
  newIPStoreContents: {external:serviceStubExtIP, internal: serviceStubIntIP}},

  { describe: "Running the script when only the internal IP has changed",
  it: "leaves the last_ip file with the latest known IPs",
  oldIPStoreContents: {external:serviceStubExtIP, internal: "5.6.7.8"},
  newIPStoreContents: {external:serviceStubExtIP, internal: serviceStubIntIP}},

  { describe: "Running the script when both the external and internal IPs have changed",
  it: "leaves the last_ip file with the latest known IPs",
  oldIPStoreContents: {external:"1.2.3.4",        internal: "5.6.7.8"},
  newIPStoreContents: {external:serviceStubExtIP, internal: serviceStubIntIP}},

  { describe: "Running the script when no IPs have changed",
  it: "leaves the last_ip file with the latest known IPs",
  oldIPStoreContents: {external:serviceStubExtIP, internal: serviceStubIntIP},
  newIPStoreContents: {external:serviceStubExtIP, internal: serviceStubIntIP},
  oldIPStoreOverrides: {
    exists : { completionNoticeExpected: false }}},

  { describe: "Running the script when the external IP service returns a bad response",
  it: "does not update the last_ip file",
  extIpServiceStub: {
    response: {
      body: "Service Unavailable",
      statusCode: 500 }},
  oldIPStoreContents: {external:"1.2.3.4",        internal: "5.6.7.8"},
  newIPStoreContents: {external:"1.2.3.4",        internal: "5.6.7.8"},
  completionNoticeExpected: false,
  errorNoticeExpected: true,
  oldIPStoreOverrides: {
    doesntExist : {
      checkIPStoreOnCompletion: false,
      IPStoreExistsOnCompletion: false }}},

  { describe: "Running the script when the external IP service request fails",
  it: "does not update the last_ip file",
  extIpServiceStub: {
    replyWithError: "simulated failure" },
  oldIPStoreContents: {external:"1.2.3.4",        internal: "5.6.7.8"},
  newIPStoreContents: {external:"1.2.3.4",        internal: "5.6.7.8"},
  completionNoticeExpected: false,
  errorNoticeExpected: true,
  oldIPStoreOverrides: {
    doesntExist : {
      checkIPStoreOnCompletion: false,
      IPStoreExistsOnCompletion: false }}},

  { describe: "Running the script when the internal IP service fails",
  it: "does not update the last_ip file",
  intIpServiceStub: {
    replyWithError: "simulated failure" },
  oldIPStoreContents: {external:"1.2.3.4",        internal: "5.6.7.8"},
  newIPStoreContents: {external:"1.2.3.4",        internal: "5.6.7.8"},
  completionNoticeExpected: false,
  errorNoticeExpected: true,
  oldIPStoreOverrides: {
    doesntExist : {
      checkIPStoreOnCompletion: false,
      IPStoreExistsOnCompletion: false }}},

  { describe: "Running the script when the internal IP service doesn't return eth0",
  it: "does not update the last_ip file",
  intIpServiceStub: {
    response: { malformed_response: [] } },
  oldIPStoreContents: {external:"1.2.3.4",        internal: "5.6.7.8"},
  newIPStoreContents: {external:"1.2.3.4",        internal: "5.6.7.8"},
  completionNoticeExpected: false,
  errorNoticeExpected: true,
  oldIPStoreOverrides: {
    doesntExist : {
      checkIPStoreOnCompletion: false,
      IPStoreExistsOnCompletion: false }}}

]



testCases.forEach( (el) => {

  /*
   * Start with the main test case
   */

  describe(el.describe, function () {

    var oldIPStoreFileExists = [ true, false ]


    /*
     * Deviate based on whether a last_ip file existed when the script started
     */
    oldIPStoreFileExists.forEach( (storeExists) => {


      /*
       * Set up tests specific to this case
       */
      var completionNoticeExpected  = (el.hasOwnProperty('completionNoticeExpected'))?  el.completionNoticeExpected  : true
      var errorNoticeExpected       = (el.hasOwnProperty('errorNoticeExpected'))?       el.errorNoticeExpected       : false
      var checkIPStoreOnCompletion  = (el.hasOwnProperty('checkIPStoreOnCompletion'))?  el.checkIPStoreOnCompletion  : false
      var IPStoreExistsOnCompletion = (el.hasOwnProperty('IPStoreExistsOnCompletion'))? el.IPStoreExistsOnCompletion : true
      var oldIPStoreOverrides       = (el.hasOwnProperty('oldIPStoreOverrides'))?       el.oldIPStoreOverrides       : { exists:{}, doesntExist: {} }

      oldIPStoreOverrides.exists      = (oldIPStoreOverrides.hasOwnProperty('exists'))?       oldIPStoreOverrides.exists      : {}
      oldIPStoreOverrides.doesntExist = (oldIPStoreOverrides.hasOwnProperty('doesntExist'))?  oldIPStoreOverrides.doesntExist : {}



      if (storeExists) {
        completionNoticeExpected  = (oldIPStoreOverrides.exists.hasOwnProperty('completionNoticeExpected'))?       oldIPStoreOverrides.exists.completionNoticeExpected       : completionNoticeExpected
        errorNoticeExpected       = (oldIPStoreOverrides.exists.hasOwnProperty('errorNoticeExpected'))?            oldIPStoreOverrides.exists.errorNoticeExpected            : errorNoticeExpected
        checkIPStoreOnCompletion  = (oldIPStoreOverrides.exists.hasOwnProperty('checkIPStoreOnCompletion'))?       oldIPStoreOverrides.exists.checkIPStoreOnCompletion       : checkIPStoreOnCompletion
      } else {
        completionNoticeExpected  = (oldIPStoreOverrides.doesntExist.hasOwnProperty('completionNoticeExpected'))?  oldIPStoreOverrides.doesntExist.completionNoticeExpected  : completionNoticeExpected
        errorNoticeExpected       = (oldIPStoreOverrides.doesntExist.hasOwnProperty('errorNoticeExpected'))?       oldIPStoreOverrides.doesntExist.errorNoticeExpected       : errorNoticeExpected
        checkIPStoreOnCompletion  = (oldIPStoreOverrides.doesntExist.hasOwnProperty('checkIPStoreOnCompletion'))?  oldIPStoreOverrides.doesntExist.checkIPStoreOnCompletion  : checkIPStoreOnCompletion
        IPStoreExistsOnCompletion = (oldIPStoreOverrides.doesntExist.hasOwnProperty('IPStoreExistsOnCompletion'))? oldIPStoreOverrides.doesntExist.IPStoreExistsOnCompletion : IPStoreExistsOnCompletion
      }


      var description = "last_ip store file "
      description    += (storeExists)? "exists": "doesn't exist"
      description    += " at startup"


      /*
       * Here's the sub test based on the last_ip file
       */
      describe(description, function () {

        this.timeout(timeout)


        var completionNoticeSpy = null
        var errorNoticeSpy      = null
        var restore = null

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


          if (storeExists) {
            createStubStoreFile(el.oldIPStoreContents, () => {ipTracker(done)})
          } else {
            ipTracker(done)
          }
        })


        /*
	 * Test for the final value of the ip store file
	 */

        if (checkIPStoreOnCompletion) {
          it(el.it, function(done) {
            jsonFile.readFile(cfg.ipStoreFile, function(err, storeFileIPs) {
              if (err) throw new Error ('Error loading last_ip file: ' + err)
              storeFileIPs.external.should.equal(el.newIPStoreContents.external)
              storeFileIPs.internal.should.equal(el.newIPStoreContents.internal)
              done()
            })
          })
        }


        /*
	 * Test the existence of the IP store on completion
	 */

        if (!IPStoreExistsOnCompletion) {
          it("last_ip store file doesn't exist on completion", function(done) {
            jsonFile.readFile(cfg.ipStoreFile, function(err, storeFileIPs) {
              err.code.should.equal('ENOENT')
              done()
            })
          })
        }

        /*
         * Test for a completion notice
         */

        var completionNoticeIt        = "doesn't send a completion notice"
        var completionNoticeCallCount = 0
        if (completionNoticeExpected) {
          completionNoticeIt = "sends a completion notice with the new and old IP's"
          completionNoticeCallCount = 1
        }

        it(completionNoticeIt, function (done) {
          completionNoticeSpy.callCount.should.equal(completionNoticeCallCount)
          done()
	})

        /*
         * Test for an error message
         */

        var errorNoticeIt        = "doesn't send an error notice"
        var errorNoticeCallCount = 0
        if (errorNoticeExpected) {
          errorNoticeIt = "sends an error notice"
          errorNoticeCallCount = 1
        }

        it(errorNoticeIt, function (done) {
          errorNoticeSpy.callCount.should.equal(errorNoticeCallCount)
          done()
	})

        after( function (done) {
          restore()
          cleanup(null,done)
        })
      })
    })
  })



})





describe("Problems with the last_ip file", function () {


  describe("when the last_ip file can't be opened", function () {

      this.timeout(timeout)


      var completionNoticeSpy = null
      var errorNoticeSpy      = null
      var restore = null

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


        createStubStoreFile(el.oldIPStoreContents, () => {ipTracker(done)})
      })


      /*
       * Test for the final value of the ip store file
       */

      if (checkIPStoreOnCompletion) {
        it("creates a new IP store file with the new IPs", function(done) {
          jsonFile.readFile(cfg.ipStoreFile, function(err, storeFileIPs) {
            if (err) throw new Error ('Error loading last_ip file: ' + err)
            storeFileIPs.external.should.equal(el.newIPStoreContents.external)
            storeFileIPs.internal.should.equal(el.newIPStoreContents.internal)
            done()
          })
        })
      }


      /*
       * Test for a completion notice
       */

      it("sends a completion notice with the new and old IP's", function (done) {
        completionNoticeSpy.callCount.should.equal(1)
        done()
      })

      /*
       * Test for an error message
       */
      it("sends an error notice", function (done) {
        errorNoticeSpy.callCount.should.equal(1)
        done()
      })

      after( function (done) {
        restore()
        cleanup(null,done)
      })

    })
  })



  describe("when the last_ip file can't be written to", function () {
    it("sends an error message")
    it("doesn't alter the last_ip file")
  })


})
