const fs = require('fs');
const SerialPort = require('serialport');

SerialPort.list()
.then((ports) => {
    // Eggs all use FTDI UART-to-USB chips
    ports = ports.filter(p => ['Silicon Labs', 'FTDI'].indexOf(p.manufacturer) >= 0);
    return ports;    
})
.then((possibleEggPorts) => {
    possibleEggPorts.forEach((p) => {        
        let bufferedData = `Port: ${p.comName}\r\n\r\n`;
        let serialNumber;    
        let outputStream;  
        let lineBuffer = "";
        openPort(p.comName)
        .then((port) => {
	    setTimeout(() => {
               port.write('\r');
               setInterval(() => port.write('\r'), 1000);
	   }, 500);
		
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
                    console.log(`${lineBuffer}`);
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
            baudRate: 9600// 115200
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
