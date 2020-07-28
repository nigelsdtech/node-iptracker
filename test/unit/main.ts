import rewire                               from 'rewire'
import {clearStub, logStub}                 from '../utils/utils'
import * as Datastore                       from '../../src/services/Datastore'
import * as GDrive                          from '../../src/services/GDrive'
import * as reporter                        from '../../src/services/reporter'
import * as IPService                       from '../../src/services/IPService'
import {IPAddress}                          from '../../src/model/IPAddress'
import {stub, SinonStub}                    from 'sinon'
import { config } from 'chai'

const m = rewire('../../src/main')

const
    genericIntIPOld = new IPAddress('111.111.111.111'),
    genericIntIPNew = new IPAddress('111.111.111.222'),
    genericExtIPOld = new IPAddress('222.222.222.111'),
    genericExtIPNew = new IPAddress('222.222.222.222'),
    {ipStoreFile, appName, auth, drive} = require('config')


const main = m.__get__('main')

interface stubPack {
    getOldIntIP: SinonStub,
    getOldExtIP: SinonStub,
    getNewIntIP: SinonStub,
    getNewExtIP: SinonStub,
    saveNewIP: SinonStub,
    uploadTrackerReport: SinonStub,
    sendCompletionNotice: SinonStub,
    sendErrorNotice: SinonStub
}

interface stubPackConfig {
    getOldIntIP?: stubSetupArgs
    getNewIntIP?: stubSetupArgs,
    getOldExtIP?: stubSetupArgs,
    getNewExtIP?: stubSetupArgs,
    saveNewIP?: stubSetupArgs,
    uploadTrackerReport?: stubSetupArgs,
    sendCompletionNotice?: stubSetupArgs,
    sendErrorNotice?: stubSetupArgs
}


interface stubSetupArgs {
    throws?: boolean,
    ret?: any
}


function createStubPack (stubPackConfig : stubPackConfig): stubPack {

    function createStubPackStub ({
        nameOfFnToStub,
        argsForFnToStub,
        curriedArgToInspect,
        objectOfFnToStub
    }: {
        nameOfFnToStub: string,
        argsForFnToStub?: any,
        curriedArgToInspect: string,
        objectOfFnToStub: any
    }): SinonStub {
    
        const newStub = stub(objectOfFnToStub, nameOfFnToStub)
        
        if (argsForFnToStub) newStub.withArgs(argsForFnToStub);
        
        const {throws: doesStubThrow, ret} = stubPackConfig[curriedArgToInspect] ?? {
            throws: true,
            ret: `Stub ${nameOfFnToStub} not fully configured. Should not get here`
        }

        if (doesStubThrow) newStub.throws(ret); else newStub.resolves(ret)
    
        return newStub
    }

    const returnStubPack = {   
        getOldIntIP:          createStubPackStub({ nameOfFnToStub: "getOldIntIP",         objectOfFnToStub:Datastore, curriedArgToInspect: "getOldIntIP",         argsForFnToStub: {filename:ipStoreFile}}),
        getOldExtIP:          createStubPackStub({ nameOfFnToStub: "getOldExtIP",         objectOfFnToStub:Datastore, curriedArgToInspect: "getOldExtIP",         argsForFnToStub: {filename:ipStoreFile}}),
        getNewIntIP:          createStubPackStub({ nameOfFnToStub: "getInternalIP",       objectOfFnToStub:IPService, curriedArgToInspect: "getNewIntIP"          }),
        getNewExtIP:          createStubPackStub({ nameOfFnToStub: "getExternalIP",       objectOfFnToStub:IPService, curriedArgToInspect: "getNewExtIP"          }),
        saveNewIP:            createStubPackStub({ nameOfFnToStub: "saveNewIP",           objectOfFnToStub:Datastore, curriedArgToInspect: "saveNewIP"            }),
        uploadTrackerReport:  createStubPackStub({ nameOfFnToStub: "uploadTrackerReport", objectOfFnToStub:GDrive,    curriedArgToInspect: "uploadTrackerReport"  }),
        sendCompletionNotice: createStubPackStub({ nameOfFnToStub: "sendCompletionNotice",objectOfFnToStub:reporter,  curriedArgToInspect: "sendCompletionNotice" }),
        sendErrorNotice:      createStubPackStub({ nameOfFnToStub: "handleError",         objectOfFnToStub:reporter,  curriedArgToInspect: "sendErrorNotice"      })
    }

    return returnStubPack
}

function clearStubPack (stubPack: stubPack) {
    Object.values(stubPack).forEach(clearStub)
}


function testMainScript ({
    description,
    only = false,
    stubPackConfig,
    expectations: {
        errorNotice,
        completionNotice,
        saveNewIP,
        uploadTrackerReport
    }
} : {
    description: string,
    only?: boolean,
    stubPackConfig: stubPackConfig,
    expectations: {
        errorNotice? : string,
        completionNotice? : reporter.iCompletionNoticeArgs,
        saveNewIP?: Datastore.iSaveNewIPArgs,
        uploadTrackerReport?: GDrive.iUploaderTrackerReportArgs
    }
}) {

    const describeFn : Function = (only)? describe.only : describe;

    describeFn(description, () => {

        var stubs: stubPack;

        before (async () => {
            stubs = createStubPack(stubPackConfig)
            await main({log: logStub})
        })

        after (() => { clearStubPack(stubs) })

        function createTestForStub (
            decider: boolean,
            descriptionWhenCalled: string,
            descriptionWhenNotCalled: string,
            stubToTest: string,
            expectedArgs: any
        ) {
            if (decider) {
                it(descriptionWhenCalled, () => { stubs[stubToTest].getCall(0).args[0].should.eql(expectedArgs) })
            } else {
                it(descriptionWhenNotCalled, () => { stubs[stubToTest].called.should.eql(false) })
            }
        }

        createTestForStub((uploadTrackerReport)? true : false,"Uploads a tracker report  ","Doesn't upload a tracker report", 'uploadTrackerReport', uploadTrackerReport)
        createTestForStub((saveNewIP)?           true : false,"Saves the data locally"    ,"Doesn't save the data locally", 'saveNewIP', saveNewIP)
        createTestForStub((completionNotice)?    true : false,"Sends a completion message","Doesn't send a completion message", 'sendCompletionNotice', completionNotice)

        if (errorNotice) {
            it('Sends an error message', () => {
                stubs.sendErrorNotice.getCall(0).args[0].err.name.should.eql(errorNotice)
            })
        } else {
            it('Does not send an error message', () => {
                stubs.sendErrorNotice.called.should.eql(false)
            })
        }

    })

}


describe('Main program', ()=>{

    const [goIP, goEP, gnIP, gnEP] = [
        {throws: false, ret: genericIntIPOld},
        {throws: false, ret: genericExtIPOld},
        {throws: false, ret: genericIntIPNew},
        {throws: false, ret: genericExtIPNew},
    ]

    const stubPackConfigTemplate = {
        getOldIntIP: goIP,
        getOldExtIP: goEP,
        getNewIntIP: gnIP,
        getNewExtIP: gnEP
    }

    const stubPackConfigTemplateError = Object.assign({}, stubPackConfigTemplate, {sendErrorNotice: {throws: false}})

    const stubPackConfigTemplateSuccess = Object.assign({}, stubPackConfigTemplate, {
        saveNewIP: {throws: false},
        sendCompletionNotice: {throws: false}
    })

    const uploadTrackerReportTemplate : GDrive.iUploaderTrackerReportArgs = {
        ips: {
            new : {
              internal: genericIntIPNew,
              external: genericExtIPNew
            },
            old: {
              internal: genericIntIPOld,
              external: genericExtIPOld
            }
          },
          drive: {
            auth: {
              googleScopes: auth.googleScopes,
              tokenFile: auth.tokenFile,
              tokenDir: auth.tokenDir,
              clientSecretFile: auth.clientSecretFile
            },
            folderName: drive.folderName
          },
          templateFile: drive.templateFile,
          appName: appName
    }
    
    const driveUrl = 'http://www.driveFileUrl.com'
 
    const tests = [{
        description: 'Problems getting the old internal IP',
        stubPackConfig: Object.assign({}, stubPackConfigTemplateError, {getOldIntIP: {throws: true, ret: 'Fake error getting old internal IP'}}),
        expectations: {errorNotice: 'Fake error getting old internal IP'}
    },{
        description: 'Problems getting the old external IP',
        stubPackConfig: Object.assign({}, stubPackConfigTemplateError, {getOldExtIP: {throws: true, ret: 'Fake error getting old external IP'}}),
        expectations: {errorNotice: 'Fake error getting old external IP'}
    },{
        description: 'Problems getting the new internal IP',
        stubPackConfig: Object.assign({},stubPackConfigTemplateError, {getNewIntIP: {throws: true, ret: 'Fake error getting new internal IP'}}),
        expectations: {errorNotice: 'Fake error getting new internal IP'}
    },{
        description: 'Problems getting the new external IP',
        stubPackConfig: Object.assign({},stubPackConfigTemplateError, {getNewExtIP: {throws: true, ret: 'Fake error getting new external IP'}}),
        expectations: {errorNotice: 'Fake error getting new external IP'}
    },{
        description: 'No IPs have changed',
        stubPackConfig: {
            getOldIntIP: goIP,
            getOldExtIP: goEP,
            getNewIntIP: goIP,
            getNewExtIP: goEP
        },
        expectations: {}
    },{
        description: 'Internal IP has changed',
        stubPackConfig: Object.assign({}, stubPackConfigTemplateSuccess, {
            getNewExtIP: goEP,
            uploadTrackerReport: {throws: false, ret: `${driveUrl}/intIPChanged`}
        }),
        expectations: {
            completionNotice: {
                ips: {
                    old: {
                        internal: genericIntIPOld,
                        external: genericExtIPOld
                    },
                    new: {
                        internal: genericIntIPNew,
                        external: genericExtIPOld
                    }
                },
                driveFileUrl: `${driveUrl}/intIPChanged`
            },
            saveNewIP: {
                contents: { internal: genericIntIPNew, external: genericExtIPOld },
                fileName: ipStoreFile
            },
            uploadTrackerReport: Object.assign( {}, uploadTrackerReportTemplate, {
                ips: {
                    new : {
                        internal: genericIntIPNew,
                        external: genericExtIPOld
                    },
                    old: {
                        internal: genericIntIPOld,
                        external: genericExtIPOld
                    }
                },
            })
        }
    },{
        description: 'External IP has changed',
        stubPackConfig: Object.assign({}, stubPackConfigTemplateSuccess, {
            getNewIntIP: goIP,
            uploadTrackerReport: {throws: false, ret: `${driveUrl}/extIPChanged`}
        }),
        expectations: {
            completionNotice: {
                ips: {
                    old: {
                        internal: genericIntIPOld,
                        external: genericExtIPOld
                    },
                    new: {
                        internal: genericIntIPOld,
                        external: genericExtIPNew
                    }
                },
                driveFileUrl: `${driveUrl}/extIPChanged`
            },
            saveNewIP: {
                contents: { internal: genericIntIPOld, external: genericExtIPNew },
                fileName: ipStoreFile
            },
            uploadTrackerReport: Object.assign( {}, uploadTrackerReportTemplate, {
                ips: {
                    new : {
                        internal: genericIntIPOld,
                        external: genericExtIPNew
                    },
                    old: {
                        internal: genericIntIPOld,
                        external: genericExtIPOld
                    }
                },
            })
        }
    },{
        description: 'Both IPs have changed',
        stubPackConfig: Object.assign({}, stubPackConfigTemplateSuccess, {
            uploadTrackerReport: {throws: false, ret: `${driveUrl}/bothIPsChanged`}
        }),
        expectations: {
            completionNotice: {
                ips: {
                    old: {
                        internal: genericIntIPOld,
                        external: genericExtIPOld
                    },
                    new: {
                        internal: genericIntIPNew,
                        external: genericExtIPNew
                    }
                },
                driveFileUrl: `${driveUrl}/bothIPsChanged`
            },
            saveNewIP: {
                contents: { internal: genericIntIPNew, external: genericExtIPNew },
                fileName: ipStoreFile
            },
            uploadTrackerReport: uploadTrackerReportTemplate
        }
    },{
        description: 'Both IPs have changed but gdrive upload fails',
        stubPackConfig: Object.assign({},stubPackConfigTemplateError, {
            uploadTrackerReport: {throws: true, ret: 'Fake error while uploading to gDrive'}
        }),
        expectations: {
            errorNotice: 'Fake error while uploading to gDrive',
            uploadTrackerReport: uploadTrackerReportTemplate
        }
    },{
        description: 'Both IPs have changed but saving to a file fails',
        stubPackConfig: Object.assign({},stubPackConfigTemplateError, {
            uploadTrackerReport: {throws: false},
            saveNewIP: {throws: true, ret: 'Fake error while saving to file'}
        }),
        expectations: {
            uploadTrackerReport: uploadTrackerReportTemplate,
            saveNewIP: {
                contents: {
                    internal: genericIntIPNew,
                    external: genericExtIPNew
                },
                fileName: ipStoreFile
            },
            errorNotice: 'Fake error while saving to file',
        }
    }]

    tests.forEach((t) => {testMainScript(t)})
    
})