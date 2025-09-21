const net = require('net');
const dns = require('dns');
const tls = require('tls');
const config = require('./config.json');

const interval = 1800;// interval unit: second
const userId = config.userId;
const password = config.password;

/*
    - dnsList format
    [[domain1, host1, host2], [domain2, host3, host4, host5], [domain3, host6]]
*/
const dnsList = require('./dnsList.json');

// IP アドレスを取得
/*
    (async ()=>{
    const myIP = await getIPv4();
    console.log('Current IP:', myIP);
    })();
*/

function getIPv4() {
    return new Promise((resolve, reject) => {
        // ddnsclient.onamae.com 65000
        const options = {
            host: 'ddnsclient.onamae.com',
            port: 65000,
            timeout: 3000  // Timeout in milliseconds
        };
        let res = '';
        const connection = net.createConnection(options);
        connection.on('data', (data) => {
            res += data;
        });
        connection.on('end', () => {
            const ip = res.match(/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/)[0];
            resolve(ip)
        });
        connection.on('error', (err) => {
            reject(err);
        });
        setTimeout(() => {
            connection.destroy();
            reject(new Error("接続がタイムアウトしました。"));
        }, 3000);
    });
}

class onamaeDDNSProtocol {
    constructor(userId, password, hostname, domain, ip) {
        this.login = `LOGIN\nUSERID:${userId}\nPASSWORD:${password}\n.\n`;
        this.modip = `MODIP\nHOSTNAME:${hostname}\nDOMNAME:${domain}\nIPV4:${ip}\n.\n`;
        this.logout = 'LOGOUT\n.\n';
    }
}

// ドメインのIPアドレスを更新

async function refreshDNS(hostname, domain, ip) {
    const FQDN = hostname + '.' + domain;
    const addresses = await new Promise((resolve, reject) => {
        dns.resolve4(FQDN, (err, addresses) => {
            if (err) {
                console.log("dns resolve failure", FQDN);
                reject();
            }
            else resolve(addresses);
        });
    });
    if (!addresses) return;
    if (addresses[0] === ip) {
        console.log("No update required for " + FQDN + " ip addresses: " + addresses.join(", "));
        return;
    }

    const options = {
        host: 'ddnsclient.onamae.com',
        port: 65010,
        timeout: 15000
    };
    const connection = net.createConnection(options, () => {
        const tlsSocket = tls.connect({
            socket: connection,
            servername: options.host,
        });
        let connecting = true;
        tlsSocket.on("end", () => {
            connecting = false;
        });
        const oDP = new onamaeDDNSProtocol(userId, password, hostname, domain, ip);
        if (connecting) {
            tlsSocket.write(oDP.login);
        }
        if (connecting) tlsSocket.write(oDP.modip);
        if (connecting) tlsSocket.write(oDP.logout);
        if (connecting) {
            console.log(`Updated ${FQDN} to ${ip}`);
            tlsSocket.end();
        }
        else console.log(`Failed to update ${FQDN} to ${ip}`);
    });
}


// 全てのリストアップされたDNS(dnsList.json)を更新
const updateDNS = async () => {
    const ip = await getIPv4();
    console.log("Current IP Address:", ip);
    dnsList.forEach(([domain, ...hostnames]) => {
        hostnames.forEach(hostname => {
            refreshDNS(hostname, domain, ip);
        });
    });
}

// run regularly
updateDNS();
setInterval(() => {
    updateDNS();
}, interval * 1000);
