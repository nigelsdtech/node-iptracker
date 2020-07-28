import { getOldIntIP, getOldExtIP, saveNewIP } from '../../../src/services/Datastore';
import { should } from 'chai';
import 'mocha';
import { IPAddress } from '../../../src/model/IPAddress';
import jsonfile from 'jsonfile'
import {stub} from 'sinon'
import {promises as fsPromises} from 'fs'

const {readFile, writeFile} = jsonfile
const {unlink: deleteFile, access: doesFileExist} = fsPromises

should()

describe('Datastore', ()=>{

  describe('saveNewIP', () => {

    const fileName = '/tmp/testFileSaveNewIP.json'
    const content = {
      internal: new IPAddress('1.2.3.4'),
      external: new IPAddress('5.6.7.8')
    }
  
    it("saves data in the correct format", async () => {
      await saveNewIP({
        contents: content,
        fileName: fileName
      })
  
      const contents = await readFile(fileName)
      contents.internal.should.eql('1.2.3.4')
      contents.external.should.eql('5.6.7.8')
  
      await deleteFile(fileName)
    });
  
    it("returns an error if the data can't be saved and trashes the existing file", async () => {
      const s = stub(jsonfile, "writeFile").rejects('Fake error')
  
      try{
        await saveNewIP({
          fileName: fileName,
          contents: content
        });
        throw new Error("Should not get here")
      } catch (e) {
        console.log(`error is ${e}`)
        e.message.should.equal('writeStoreFileContents: Error writing to IP file: ')
      }
      
      s.reset(); s.restore()
  
      try {
        await doesFileExist(fileName)
      } catch (e) {
        e.code.should.eql('ENOENT')
      }
  
    });
  
  })
  
  function testGetOldIP (IPSource: "Int" | "Ext") : void {

    const descName = `getOld${IPSource}IP`

    describe(descName, () => {
  
      const fileName = `/tmp/testFileGetOld${IPSource}IP.json`
      const fnToExecute = (IPSource == "Int")? getOldIntIP : getOldExtIP;
    
      it("returns 0'ed out IP's when the data hasn't been saved before", async () => {
    
        const retrievedIp: IPAddress = await fnToExecute({fileName: fileName});
        const ip = retrievedIp.toString()
        ip.should.equal('0.0.0.0');
        
      });
    
      it("returns IP's when the data exists", async () => {
    
        await writeFile(fileName, {
          internal: '11.12.13.14',
          external: '15.16.17.18'
        })
    
        const storedIP : String = (await fnToExecute({fileName: fileName})).toString()
        
        const expectedIP = (IPSource == "Int")? '11.12.13.14' : '15.16.17.18';
        storedIP.should.eql(expectedIP)
    
        await deleteFile(fileName)
    
      });
    
      it("throws an error when the data is bad", async () => {
    
        await writeFile(fileName, {
          badField: 1234,
          dudField: false
        })
    
        try {
          await fnToExecute({fileName: fileName})
          throw new Error("Should not get here")
        } catch (e) {
          console.error(`Got error: ${e}`)
          e.message.should.eql('Invalid IP address: undefined')
    
        }
    
        await deleteFile(fileName)
    
      });
    });
  }

  testGetOldIP("Int")
  testGetOldIP("Ext")
  
})