export class IPAddress {
    constructor (public ip: string) {

        // Run some validations
        const re = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})(\/\d{1,2})?$/
        const match = re.exec(ip)
        if (!match) {
            throw new Error(`Invalid IP address: ${ip}`)
        }
        for (let i = 0; i < 4; i++) {
            let oct = parseInt(match[i + 1])
            if (oct > 255) {
                throw new Error(`Invalid IP address: ${ip}`)
            }
        }
    }

    toString (): string {
        return `${this.ip}`
    }
}
