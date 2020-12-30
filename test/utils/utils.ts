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
    
    throw new Error ('Should not get here')
}

function stubFn () {}
const logStub = {
    info: stubFn,
    debug: stubFn,
    error: stubFn,
}

export {clearStub, getThrownError, logStub};
