import nock from 'nock'
import {stub, SinonStub} from 'sinon'
import {NetworkInfo} from 'simple-ifconfig'
import jsonFile, { Path } from 'jsonfile'


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
    ip,
    replyWithError = false
} : {
    ip: string,
    replyWithError: boolean
}) : SinonStub {

    const s = stub(NetworkInfo.prototype, 'listInterfaces')

    const response = [
        {
            "active": true,
            "hardwareAddress": "ab:cd:12:23:34:45",
            "internal": false,
            "name": "en5",
            "flags": {
                    "broadcast": true,
                    "multicast": true,
                    "running": true,
                    "simplex": true,
                    "smart": true,
                    "up": true
            },
            "index": 4,
            "mtu": 1500,
            "ipv6": [
                {
                    "address": "fe12::eeee:42ff:fe012:3456",
                    "prefixLength": 64
                }
            ]
        },
        {
            "active": true,
            "hardwareAddress": "3c:12:fb:d8:18:b2",
            "internal": false,
            "name": "en0",
            "flags": {
                "broadcast": true,
                "multicast": true,
                "running": true,
                "simplex": true,
                "smart": true,
                "up": true
            },
            "index": 6,
            "mtu": 1500,
            "ipv6": [
                {
                    "address": "ab12:fc3f:45d6:7:f00e:a6a3:e86:2122",
                    "prefixLength": 64
                }
            ],
            "ipv4": [
                {
                    "address": ip,
                    "netmask": "255.255.255.0",
                    "broadcast": "192.168.0.255"
                }
            ]
        }
]

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

function clearStubs (): void {
    nock.cleanAll()
}

export {createStubStoreFile, stubExtIpService, stubIntIpService, clearStubs}