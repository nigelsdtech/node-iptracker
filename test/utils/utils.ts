import { SinonStub } from 'sinon'


function clearStub(s: SinonStub): void {
    if (s.called) {s.reset()}
    s.restore()
  }
  
async function getThrownError(fn: Function, values: any): Promise<Error> {
    try {
        await fn(values)
    } catch (e) {
        return e
    }
    return new Error('Should not get here')
}

const logStub = {
    stubFn: () => {},
    info: this.stubFn,
    debug: this.stubFn,
    error: this.stubFn,
}

export {clearStub, getThrownError, logStub};
