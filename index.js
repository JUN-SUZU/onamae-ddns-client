const net = require('net');
const dns = require('dns');
const tls = require('tls');
const config = require('./config.json');

const interval = 1800;
const userId = config.userId;
const password = config.password;
const hostnames = ['www', 'hogehoge'];
const domain = 'example.com';

// get IPv4 address
function getIPv4() {
    // ddnsclient.onamae.com 65000
    const options = {
        host: 'ddnsclient.onamae.com',
        port: 65000,
        timeout: 15000  // Timeout in milliseconds
    };
    let res = '';
    net.createConnection(options).on('data', (data) => {
        res += data;
    }).on('end', () => {
        const ip = res.match(/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/)[0];
        updateDNS(ip);
    });
}

// update DNS
function updateDNS(ip) {
    hostnames.forEach((hostname) => {
        dns.resolve4(`${hostname}.${domain}`, (err, addresses) => {
            if (err) {
                console.log(err);
                return;
            }
            if (addresses[0] === ip) {
                console.log('No update required');
                return;
            }
            else {
                const context = tls.createSecureContext();
                const options = {
                    host: 'ddnsclient.onamae.com',
                    port: 65010,
                    timeout: 15000
                };
                const connection = net.createConnection(options, () => {
                    console.log('Connected to server, now wrapping with TLS...');
                    const tlsSocket = tls.connect({
                        socket: connection,
                        servername: options.host,
                    });
                    let loginned = false;
                    let connecting = true;
                    tlsSocket.on("data", (data) => {
                        console.log(`Received: ${data.toString()}`);
                        // if (data.toString().match(/\d+/)) {
                        //     if (loginned) {
                        //         tlsSocket.write(`LOGOUT\n.\n`);
                        //     }
                        //     tlsSocket.end();
                        // }
                    });
                    tlsSocket.on("end", () => {
                        connecting = false;
                    });
                    if (connecting) {
                        tlsSocket.write(`LOGIN\nUSERID:${userId}\nPASSWORD:${password}\n.\n`);
                        loginned = true;
                    }
                    if (connecting) tlsSocket.write(`MODIP\nHOSTNAME:${hostname}\nDOMNAME:${domain}\nIPV4:${ip}\n.\n`);
                    if (connecting) tlsSocket.write('LOGOUT\n.\n');
                    if (connecting) console.log(`Updated ${hostname}.${domain} to ${ip}`);
                    else console.log(`Failed to update ${hostname}.${domain} to ${ip}`);
                    if (connecting) tlsSocket.end();
                });
            }
        });
    });
}

getIPv4();
