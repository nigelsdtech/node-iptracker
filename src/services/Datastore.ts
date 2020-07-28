import {readFile, writeFile, Path}       from 'jsonfile';
import {promises as fsPromises}          from 'fs';
import memoizee                          from 'memoizee';
import {IPAddress}                       from '../model/IPAddress'

const
    log4js         = require('log4js'),
    {log: logCfg}  = require('config');


interface iStoreFileContents {
    internal: IPAddress
    external: IPAddress
}

/*
* Logs
*/
log4js.configure(logCfg.log4jsConfigs);

var log = log4js.getLogger(logCfg.appName);
log.setLevel(logCfg.level);


/**
 * readStoreFileContents
 * @desc Loads previously stored IPs
 *
 */
function readStoreFileContentsUnMemo ({fileName}: {
    fileName: Path
}) : Promise<iStoreFileContents> {

    log.debug('getOldIPs: Getting file ' + fileName)
        
    const contents = readFile(fileName)
        .then( ({internal, external}) => {

            log.debug(`getStoreFileContents - Old IPs: [internal: ${internal}, external: ${external}]`)

            return {
                internal: new IPAddress(internal),
                external: new IPAddress(external)
            }

        })
        .catch ( err => {
            if (err.code == "ENOENT") {
                // The file doesn't exist. Just set dummy values for now
                log.info('Old IP file doesn\'t exist')
                return {
                    internal: new IPAddress('0.0.0.0'),
                    external: new IPAddress('0.0.0.0')
                }
            } else {
                throw err
            }
        })

    return contents

}
const readStoreFileContents = memoizee(readStoreFileContentsUnMemo)

/**
 * getOldIP
 * @desc Gets a stored IP from the data store
 *
 * @returns {IPAddress} - the IP address stored in the file
 */
async function getOldIP ({IPSource, fileName}: {
    IPSource: "internal" | "external",
    fileName: Path
}): Promise<IPAddress> {
    const contents = await readStoreFileContents({ fileName: fileName });
    return contents[IPSource];
}

/**
 * getOldIntIP
 * @desc Gets the stored internal IP from the data store
 *
 * @returns {IPAddress} - the IP address stored in the file
 */
async function getOldIntIP ({fileName}: {fileName: Path}): Promise<IPAddress> {
    return getOldIP({IPSource: "internal", fileName})
}

/**
 * getOldIExtP
 * @desc Gets the stored external IP from the data store
 *
 * @returns {IPAddress} - the IP address stored in the file
 */
async function getOldExtIP ({fileName}: {fileName: Path}): Promise<IPAddress> {
    return getOldIP({IPSource: "external", fileName})
}

interface iSaveNewIPArgs {
    contents: iStoreFileContents,
    fileName: string
}

/**
 * writeStoreFileContents
 * @desc Replaces the contents of the store file
 *
 */
async function writeStoreFileContents ({contents, fileName} : iSaveNewIPArgs): Promise<void> {

    const fn = "writeStoreFileContents"
    // Store to the file
    log.info(`${fn}: Writing to file...`)

    try {
        await writeFile(fileName, {
            internal: contents.internal.toString(),
            external: contents.external.toString()
        })
    } catch (err) {

        const errMsg = `${fn}: Error writing to IP file: ${err.message}`
        log.error(errMsg)

        // Trash the old file and report on the error
        try {
            await fsPromises.unlink(fileName)
        } catch (err2) {
            if (err2.code != "ENOENT") {
                const newErrMsg = errMsg + "| Additional error trashing the IP store file: " + err2.message
                throw new Error(newErrMsg)
            }
        }

        throw new Error(errMsg)
    }

    log.info(`${fn}: Written to file`)

}

export {getOldIntIP, getOldExtIP, writeStoreFileContents as saveNewIP, iStoreFileContents, iSaveNewIPArgs}