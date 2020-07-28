import nock from 'nock'
import {stub, SinonStub} from 'sinon'
import {NetworkInfo} from 'simple-ifconfig'
import jsonFile, { Path } from 'jsonfile'
import { IPAddress } from '../../../src/model/IPAddress'


/*
 * Stubbed external IP service
 */
function stubExtIpService ({
    ipService,
    responseBody = {
        ip: '123.456.789',
        ip_decimal:1234567,
        country:"Fake country",
        city:"Fake city",
        hostname:"fakehost.ipland.com"
    },
    responseStatusCode = 200,
    replyWithError = false
}: {
    ipService: string,
    responseBody: any,
    responseStatusCode?: number,
    replyWithError?: boolean
}): void  {

    const ret = nock(ipService, {
      reqheaders: {
        'Accept': 'application/json'
      }
    })
    .get("/")
  
    if (replyWithError) {
        ret.replyWithError(responseBody)
    } else {
        ret.reply(responseStatusCode, responseBody)
    }

  }


/*
 * Stubbed internal IP service
 */
function stubIntIpService ({
    response,
    replyWithError = false
} : {
    response: string,
    replyWithError: boolean
}) : SinonStub {
  
    const s = stub(NetworkInfo.prototype, 'listInterfaces')

    if (replyWithError) {
        s.rejects(response)
    } else {
        s.resolves(response)
    }
  
    return s
}


/**
 * createStubStoreFile
 * @desc Create a generic stub store file
 *
 * @param {Path}  ipStoreFile
 * @param {any} contents
 */
function createStubStoreFile ({ipStoreFile, contents} : {
    ipStoreFile: Path,
    contents: any
}) {

    // Create a store file with the stub IP
    jsonFile.writeFile(ipStoreFile, contents);
  
}


export {createStubStoreFile, stubExtIpService, stubIntIpService}