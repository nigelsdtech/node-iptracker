import {NetworkInfo as Ifconfig} from 'simple-ifconfig'
import {promisify}  from 'util'
import request      from 'request';
import {IPAddress}  from '../model/IPAddress'

const 
    cfg    = require('config'),
    log4js = require('log4js');

/*
* Logs
*/
log4js.configure(cfg.log.log4jsConfigs);

var log = log4js.getLogger(cfg.log.appName);
log.setLevel(cfg.log.level);


const requestPromise = promisify(request)

/**
 * getExternalIP
 * @desc gets the external IP address of the device
 *
 * @returns {Promise<IPAddress>} IP address of this machine
 */
async function getExternalIP (): Promise<IPAddress> {

    log.debug(`getExternalIP - Getting...`)

    const {statusCode, body} = await requestPromise({
        json: true,
        method: "GET",
        uri: cfg.ipService
    })
    .catch( (e: Error) => {
        throw (`getExternalIP - could not get IP: ${e.message}`)
    })

    if (statusCode != 200) {
        throw new Error(`getExternalIP - statusCode: ${statusCode} -- body: ${body}`);
    }
    
    if (!body.ip) {
        throw new Error(`getExternalIP - unexpected body: ${JSON.stringify(body)}`);
    }

    const extIP = new IPAddress(body.ip)

    log.debug(`getExternalIP - Got ${extIP.toString()}`)

    return extIP

}

/**
 * getInternalIP
 * @desc gets the internal IP address of the device
 *
 * @returns {Promise<IPAddress>} IP address
 *
 */
async function getInternalIP (): Promise<IPAddress> {

    log.debug(`getInternalIP - Getting...`)

    const ifconfig = new Ifconfig();
    const ifconfigData = await ifconfig.listInterfaces()
    const ip = (() => {
        try {
            return ifconfigData[0].ipv4[0].address
        } catch (e) {
            throw new Error ('getInternalIP - IP not in expected location')
        }
    })()
    
    log.debug(`getInternalIP - got...${ip}`)

    return new IPAddress(ip)
}

export {getExternalIP, getInternalIP}