import {readFile} from 'jsonfile'

function getIPStoreFile ({fileName}
    : {fileName: string}
): Promise<Object> {
    try {
        return readFile(fileName)
    } catch (e) {
        if (e.code == 'ENOENT') {return Promise.resolve('ENOENT')}
        throw e
    }
}

export {getIPStoreFile}