import {uploadTrackerReport} from '../../../src/services/GDrive';
import rewire from 'rewire';
import GdriveModel from 'gdrive-model'
import { should } from 'chai';
import 'mocha';
import {stub, SinonStub} from 'sinon'
import {promises as fsPromises} from 'fs'
import { IPAddress } from '../../../src/model/IPAddress';
import {clearStub, getThrownError} from '../../utils/utils'

const {unlink: deleteFile, writeFile} = fsPromises

should()

const gdr = rewire('../../../src/services/GDrive');


describe('GDrive', () => {

  describe('uploadTrackerReport', () => {

    const fileName = '/tmp/testUploadTrackerReport.json'
    const utrArgs = {
      ips: {
        new : {
          internal: new IPAddress("1.2.3.4"),
          external: new IPAddress("5.6.7.8")
        },
        old: {
          internal: new IPAddress("9.10.11.12"),
          external: new IPAddress("13.14.15.16")
        }
      },
      drive: {
        auth: {
          googleScopes: ["a","b"],
          tokenFile: "c",
          tokenDir: "d",
          clientSecretFile: "e.f"
        },
        folderName: "g"
      },
      templateFile: fileName,
      appName: "This is an app"
    }
    let url: string, listFilesStub: SinonStub, createFileStub: SinonStub;
    const retUrl = "http://www.mynewfile.com"

    async function getUtrError(): Promise<Error> {
      return getThrownError(uploadTrackerReport, utrArgs)
    }

    before(async () => {
      await writeFile(fileName, "Your new IP is NEW_EXT_IP!")
    })
  
    afterEach(()=> {
      listFilesStub.restore()
      createFileStub.restore()
    })

    after(async () => {
      await deleteFile(fileName)
    })

    describe("Uploading the file successfully", () => {

      before(async ()=> {

        listFilesStub  = stub(GdriveModel.prototype, "listFiles") .yields(null,[{id: 'parentFolder1'}])
        createFileStub = stub(GdriveModel.prototype, "createFile").yields(null,{webViewLink:retUrl})

        url = await uploadTrackerReport(utrArgs)
      })

      it("The file content looks as expected", async () => {
        // True because of IP address in the media body
        createFileStub
        .calledWith({
          media: {
            body: "Your new IP is 5.6.7.8!"
          },
          resource: {
            description: 'File uploaded by This is an app',
            mimeType: 'text/plain',
            parents: [{id: "parentFolder1"}],
            title: "testUploadTrackerReport.json"
          },
          retFields: ['webViewLink']
        })
        .should.eql(true)
      })

      it("Returns the new file URL", ()=> {
        url.should.eql(retUrl)
      })
    })
    
    it("Throws an error if the file couldn't be uploaded", async () => {
      listFilesStub  = stub(GdriveModel.prototype, "listFiles") .yields(null,[{id: 'parentFolder1b'}])
      createFileStub = stub(GdriveModel.prototype, "createFile").throws('Error creating new file')

      const err: Error = await getUtrError()
      .catch(e => {throw new Error(e)})

      err.message.should.eql('uploadTrackerReport: Unable to upload iptracker file: Error creating new file')
    })

    it("Throws an error if there was a problem with the parent folder", async () => {
      listFilesStub  = stub(GdriveModel.prototype, "listFiles").yields(null,[{id: 'parentFolder1'}, {id: 'parentFolder2'}])
      createFileStub = stub(GdriveModel.prototype, "createFile")

      const e = await getUtrError()
      e.message.should.eql('uploadTrackerReport: Unable to get parent folder ID: Error: drive: did not receive exactly one parent folder')
      createFileStub.called.should.eql(false)
    })
  
  })
  
  describe('getParentFolderDetails', () => {
  
    const getParentFolderId = gdr.__get__('getParentFolderId')
  
    const g = new GdriveModel({
      clientSecretFile: "abc",
      googleScopes: ["d", "e"],
      tokenDir: "fgh",
      tokenFile: "ijk",
      userId: 'lm'
    })
  
    function setStub(
      returnType: "resolve" | "reject" | "throw",
      value: any
    ): SinonStub {
      const s = stub(GdriveModel.prototype, "listFiles")
      
      switch (returnType) {
        case "resolve": s.yields(null,value); break;
        case "reject": s.yields(value); break;
        case "throw": s.throws(value); break;
      }
      return s
    }
  
    async function getPFIdError(): Promise<Error> {
      return getThrownError(getParentFolderId, {g: g, folderName: 'myTestFolder'})
    }
  
    it('Returns an id if everything is ok', async () => {
      const s = setStub('resolve', [{id:'id1'}])
      const id: String = await getParentFolderId({g: g, folderName: 'myTestFolder'})
      id.should.eql('id1')
      clearStub(s)
    })
  
    it('Bugs out if too many folders are found', async () => {
      const s = setStub('resolve', [{id:'id1'}, {id:'id2'}])    
      const e = await getPFIdError()
      e.message.should.eql('drive: did not receive exactly one parent folder')
      clearStub(s)
    })
    it('Bugs out if no folders are found', async() => {
      const s = setStub('resolve', [])
      const e = await getPFIdError()
      e.message.should.eql('drive: did not receive exactly one parent folder')
      clearStub(s)
    })
  
    it('Bugs out if google drive returns something unexpected', async() => {
      const s = setStub('resolve', [{hey: "you"}])
      const e = await getPFIdError()
      e.message.should.eql('drive: Did not get an id. Full result is [{"hey":"you"}]')    
      clearStub(s)
    })
  
    it('Returns gracefully if listFiles returns a handled error', async() => {
      const s = setStub('reject', 'Fake error contacting drive')
      const e = await getPFIdError()
      e.should.eql('Fake error contacting drive')
      clearStub(s)
    })
  
    it('Bugs out if listFiles returns an unhandled error', async() => {
      const s = setStub('throw', 'Fake error everything is broken')
      const e = await getPFIdError()
      e.name.should.eql('Fake error everything is broken')
      clearStub(s)
    })
  })
})