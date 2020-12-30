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

    const ifconfig = new Ifconfig({active: false});
    const ifconfigData = await ifconfig.listInterfaces()
    log.debug(`getInternalIP - Got... ${JSON.stringify(ifconfigData,null,"\t")}`)
    const ip = (() => {
        try {
            const connectionWithIPv4 = ifconfigData.find(el => {
                return (["eth0", "wlan0"].indexOf(el.name) > -1 && el.hasOwnProperty("ipv4"))
            })

            if (!connectionWithIPv4) throw new Error ('No device with ipv4 address')

            const ipv4: string = connectionWithIPv4.ipv4[0].address

            return ipv4
        } catch (e) {
            log.error(`getInternalIp - IP not in expected location:\n${JSON.stringify(ifconfigData,null,"\t")}`)
            throw new Error (`getInternalIP - IP not in expected location`)
        }
    })()
    
    log.debug(`getInternalIP - Got ${ip}`)

    return new IPAddress(ip)
}

export {getExternalIP, getInternalIP}
