'use strict'

var
  cfg       = require('config'),
  chai      = require('chai'),
  forEach   = require('mocha-each'),
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



  return nock(cfg.ipService, {
    reqheaders: {
      'Accept': 'application/json'
    }
  })
  .get('/')
  .reply(params.response.statusCode, params.response.body)
  .persist()
}

stubExtIpService();


/*
 * Stubbed internal IP service
 */

var serviceStubIntIP = "88.8.8.88"
var ipTrackerRewire = ipTracker.__set__('ifconfig', function (p,cb) {
    return Q.resolve({ eth0: { inet: { addr: serviceStubIntIP } } })
})



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
  .done(  function ()    { cb() })

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
  newIPStoreContents: {external:"1.2.3.4",        internal: serviceStubIntIP}},

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
    exists : { completionNoticeExpected: false }}}

]

var moreTestCases = [

  { describe: "Running the script when the external IP service is unavailable",
  it: "does not update the last_ip file",
  oldIPStoreContents: {external:"1.2.3.4",        internal: "5.6.7.8"},
  newIPStoreContents: {external:"1.2.3.4",        internal: "5.6.7.8"},
  completionNoticeExpected: false,
  errorNoticeExpected: true},


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
    oldIPStoreFileExists.forEach( (exists) => {


      /*
       * Set up tests specific to this case
       */
      var completionNoticeExpected = (el.hasOwnProperty('completionNoticeExpected'))? el.completionNoticeExpected : true
      var errorNoticeExpected      = (el.hasOwnProperty('errorNoticeExpected'))?      el.errorNoticeExpected : false
      var oldIPStoreOverrides      = (el.hasOwnProperty('oldIPStoreOverrides'))?      el.oldIPStoreOverrides : { exists:{}, doesntExist: {} }

      oldIPStoreOverrides.exists      = (oldIPStoreOverrides.hasOwnProperty('exists'))?       oldIPStoreOverrides.exists      : {}
      oldIPStoreOverrides.doesntExist = (oldIPStoreOverrides.hasOwnProperty('doesntExist'))?  oldIPStoreOverrides.doesntExist : {}



      if (exists) {
        completionNoticeExpected = (oldIPStoreOverrides.exists.hasOwnProperty('completionNoticeExpected'))?      oldIPStoreOverrides.exists.completionNoticeExpected      : completionNoticeExpected
        errorNoticeExpected      = (oldIPStoreOverrides.exists.hasOwnProperty('errorNoticeExpected'))?           oldIPStoreOverrides.exists.errorNoticeExpected           : errorNoticeExpected
	console.log('SteveFlag 5 - ' + completionNoticeExpected)
      } else {
        completionNoticeExpected = (oldIPStoreOverrides.doesntExist.hasOwnProperty('completionNoticeExpected'))? oldIPStoreOverrides.doesntExist.completionNoticeExpected : completionNoticeExpected
        errorNoticeExpected      = (oldIPStoreOverrides.doesntExist.hasOwnProperty('errorNoticeExpected'))?      oldIPStoreOverrides.doesntExist.errorNoticeExpected      : errorNoticeExpected
      }


      var description = "last_ip store file "
      description    += (exists)? "exists": "doesn't exist"


      /*
       * Here's the sub test based on the last_ip file
       */
      describe(description, function () {


        var completionNoticeSpy = null
        var errorNoticeSpy      = null
        var restore = null

        before( function(done) {

          completionNoticeSpy = sinon.spy();
          errorNoticeSpy      = sinon.spy();
          restore = ipTracker.__set__('reporter', {
            configure: function () {},
            handleError: errorNoticeSpy,
            sendCompletionNotice: completionNoticeSpy
          })

          if (exists) {
            createStubStoreFile(el.oldIPStoreContents, () => {ipTracker(done)})
          } else {
            ipTracker(done)
          }
        })


        /*
	 * Test for the final value of the ip store file
	 */

        it(el.it, function(done) {
          jsonFile.readFile(cfg.ipStoreFile, function(err, storeFileIPs) {
            if (err) throw new Error ('Error loading last_ip file: ' + err)
            storeFileIPs.external.should.equal(serviceStubExtIP)
            storeFileIPs.internal.should.equal(serviceStubIntIP)
            done()
          })
        })



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




describe("Running the script when the external IP service is unavailable", function () {

  it("does not update the last_ip file")
  it("sends an error message")
})

describe("Running the script when the internal IP service doesn't return eth0", function () {

  it("does not update the last_ip file")
  it("sends an error message")
})


describe("Problems with the last_ip file", function () {


  describe("when the last_ip file can't be opened", function () {
    it("sends an error message")
    it("doesn't alter the last_ip file")
  })


  describe("when the last_ip file can't be written to", function () {
    it("sends an error message")
    it("doesn't alter the last_ip file")
  })


})


describe("Problems with reporter emails", function () {


  describe("when the completion notice fails", function () {
    it("sends an error message")
    it("doesn't alter the last_ip file")
  })


  describe("error notice fails", function () {
    it("sends an error message")
    it("doesn't alter the last_ip file")
  })


  after(function (done) {
    done()
  });
})