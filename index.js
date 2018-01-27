const fs = require('fs');
const SerialPort = require('serialport');

SerialPort.list()
.then((ports) => {
    // Eggs all use FTDI UART-to-USB chips
    ports = ports.filter(p => p.manufacturer === 'FTDI');
    return ports;    
})
.then((possibleEggPorts) => {
    possibleEggPorts.forEach((p) => {        
        let bufferedData = "";
        let serialNumber;    
        let outputStream;  
        let lineBuffer = "";
        openPort(p.comName)
        .then((port) => {
            const parser = port.pipe(new SerialPort.parsers.ByteLength({length: 1}));
            parser.on('data', (data) => {
                data = data.toString();
                if(!serialNumber){
                    bufferedData = bufferedData.concat(data);
                    let temp = /egg[0-9a-f]{16}/.exec(bufferedData);
                    if(temp){
                        serialNumber = temp[0];
                        outputStream = fs.createWriteStream(`${serialNumber}.txt`,{encoding: 'utf8'});
                        outputStream.write(bufferedData);

                        // set up a process exit handler to gracefully close the stream
                        let handle = () => {     
                            console.log(`Handling process shutdown for ${serialNumber}`);
                            if(outputStream){
                                outputStream.end(() => console.log(`Closed ${serialNumber}.txt`));
                                outputStream = null;
                            }

                            if(port){
                                port.close(() => {
                                   console.log(`Port closed for ${serialNumber}`);
                                })
                                port = null;
                            }
                        };
                        process.on('SIGINT', handle);
                        process.on('SIGTERM', handle);                                             
                    }
                }
                else if(outputStream) {
                    outputStream.write(data);                    
                }

                // handle line buffer and console output
                if(data === '\n'){
                    console.log(`${serialNumber}: ${lineBuffer}`);
                    lineBuffer = "";
                }
                else if(data !== '\r'){
                    lineBuffer += data;
                }
            });
        })
        .catch((err) => {
            console.error(err, err.stack, err.message);  
            if(port) {
                port.close();
            }          
        });
    })
})

// returns a promise that resolves to the opened SerialPort after setting rts/dtr for Egg
// or rejects with an error
let openPort = (comName) => {
    return new Promise((resolve, reject) => {
        // open the port
        let port = new SerialPort(comName, {
            baudRate: 115200
        }, (err) => {
            if (err) {                
                reject(err);
            }
            else{                
                console.log(`port ${comName} opened`);                
                resolve(port);
            }
        });
    })
    .then((port) => {
        return new Promise((resolve, reject) => {
            port.set({dtr: true, rts: true}, (err) => {
                if(err){
                    reject(err);
                }
                else{
                    resolve(port);
                }
            });
        });        
    });
    
}