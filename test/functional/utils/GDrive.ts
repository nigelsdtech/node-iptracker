import {promisify} from 'util'
import {basename as getBaseName} from 'path'
import GDriveModel from 'gdrive-model';

/**
 * createTestGDriveFolder
 * @desc Create a temp google drive folder for test purposes
 *
 * @returns {Object} folder - where folder is the google drive object representing the folder
 */
async function createGDriveFolder ({
    appName,
    folderName,
    gdrive
} : {
    appName: string,
    folderName: string,
    gdrive: GDriveModel
}): Promise<string> {

    const d = new Date();
    const desc =  `Test folder created by ${appName} on ${d.toString()}`;
    const title = folderName;

    const createFile = promisify(GDriveModel.prototype.createFile).bind(gdrive)
    const newFolderObject = await createFile ({
        isFolder : true,
        resource: {
            description: desc,
            title: title
        }
    })

    return newFolderObject.id

}

/**
 * getGDriveFile
 *
 * @param {object}  params
 * @param {string}  params.folderId - parent folder of the file
 * @param {string}  params.fileName - file name
 * @param {GDriveModel}  params.gdrive - drive Object
 *
 * @returns Gdrive file object
 */
async function getGDriveFile ({
    parentFolderId = null,
    fileName,
    gdrive,
    retFields = ['files(mimeType,size,webViewLink)']
} : {
    parentFolderId?: string | null,
    fileName: string,
    gdrive: GDriveModel
    retFields?: string[]
}): Promise<any | null > {

    const freetextSearch = "".concat(
        `name = "${getBaseName(fileName)}"`,
        (parentFolderId)? ` AND "${parentFolderId}" in parents` : ""
    )

    //console.log(`Getting gdrive file with search: ${freetextSearch}`)
    const listFiles = promisify(GDriveModel.prototype.listFiles).bind(gdrive)
    const foundFiles = await listFiles ({
        freetextSearch: freetextSearch,
        spaces: "drive",
        retFields: retFields
    })

    switch (foundFiles.length) {
        case 0: return null;
        case 1: return foundFiles[0]
        default: {
            const msg = "Did not get exactly 1 file"
            console.error(msg)
            console.error(JSON.stringify(foundFiles))
            throw new Error (msg)
        }
    }
}

/**
 * getGDriveFolderId
 *
 * @param {object}  params
 * @param {string}  params.folderName - file name
 * @param {GDriveModel}  params.gdrive - drive Object
 *
 * @returns {object} Folder id
 */
async function getGDriveFolderId({
    folderName,
    gdrive
} : {
    folderName: string,
    gdrive: GDriveModel
}) : Promise<any | null> {
    const folder = await getGDriveFile({fileName: folderName, gdrive: gdrive, retFields: ['files(id)']})
    
    if (!folder) return null;

    if (folder.hasOwnProperty('id')) {
        const msg = `getGDriveFolderId: did not get an id - ${JSON.stringify(folder)}`
        console.error(msg)
        throw new Error(msg)
    }

    return folder.id

    
}

/**
 * trashTestGDriveFolder
 * @desc Trash a temp google drive folder for test purposes
 *
 * @param {object}  params
 * @param {string}  params.folderId - ID of the folder to be deleted
 * @param {GDriveModel}  params.gdrive - gdrive object containing the folder to be trashed
 *
 * @returns cb(err)
 */
async function trashGDriveFolder ({
    folderId,
    gdrive
} : {
    folderId: string,
    gdrive: GDriveModel
}): Promise<void> {

    const trashFiles = promisify(GDriveModel.prototype.trashFiles).bind(gdrive)
    await trashFiles ({
        fileIds: [folderId],
        deletePermanently: true
    })
}

export {createGDriveFolder, getGDriveFile, getGDriveFolderId, trashGDriveFolder, GDriveModel}