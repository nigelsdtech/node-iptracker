import { getExternalIP, getInternalIP } from '../../../src/services/IPService';
import { should } from 'chai';
import 'mocha';
import { IPAddress } from '../../../src/model/IPAddress';
import {stub} from 'sinon'
import nock from 'nock';
import {getThrownError, clearStub} from '../../utils/utils'
import {NetworkInfo} from 'simple-ifconfig'

const {ipService} = require('config')


should()

describe('IPService', ()=>{

  describe('getExternalIP', () => {

    function stubService({statusCode, resp}: {
      statusCode: number,
      resp: Object | string
    }) {
      nock(ipService)
      .log(console.log)
      .matchHeader('accept', 'application/json')
      .get('/')
      .reply(statusCode, resp)
    }

    async function testBadCall({statusCode, body, expectedError}: {
      statusCode: number,
      body: Object | string,
      expectedError: string
    }) {
      stubService({statusCode: statusCode, resp: body})
      const e = await getThrownError(getExternalIP,null)
      e.message.should.eql(expectedError)
    }

    afterEach(()=> {
      nock.cleanAll();
    })
    after(()=> {
      nock.restore();
    })

    it("returns a valid IP address", async () => {
      stubService({statusCode:200, resp: {ip: '1.2.3.4'}})
      const i: IPAddress = await getExternalIP()
      i.ip.should.eql('1.2.3.4')
    });

    it("throws an error if the response status code isn't as expected", async () => {
      testBadCall({statusCode: 500, body: 'system down', expectedError: 'getExternalIP - statusCode: 500 -- body: system down'})
    })

    it("throws an error if the response body isn't as expected", async () => {
      testBadCall({statusCode: 200, body: 'system down', expectedError: 'getExternalIP - unexpected body: {"hey":"you"}'})
    })

    
  })
  
  describe('getInternalIP', () => {

    it("returns a valid IP", async ()=> {
      const i: IPAddress = await getInternalIP()
      const regex = RegExp(/^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])$/)
      const isValid = regex.test(i.ip)
      isValid.should.be.true
    });

    it("throws an error if the IP is not in the specified location", async ()=> {

      const s = stub(NetworkInfo.prototype, 'listInterfaces').resolves([{
        ipv6: [
          {address: '123.456.789.1'}
        ] 
      }])
      const e = await getThrownError(getInternalIP,null)
      
      e.message.should.eql('getInternalIP - IP not in expected location')
      clearStub(s)
    });

    it("throws an error if the IP is bad", async ()=> {

      const s = stub(NetworkInfo.prototype, 'listInterfaces').resolves([{
        name: "eth0",
        ipv4: [
          {address: 'This should have been an IP address'}
        ] 
      }])
      const e = await getThrownError(getInternalIP,null)
      
      e.message.should.eql('Invalid IP address: This should have been an IP address')
      clearStub(s)
    });
  });
  
})