//jshint esversion: 8
const fs = require('fs');
const SerialPort = require('serialport');
const moment = require('moment');

SerialPort.list()
  .then((ports) => {
    // Eggs all use FTDI UART-to-USB chips
    // console.log(ports);
    ports = ports.filter(p => ['Arduino (www.arduino.cc)', 'Silicon Labs', 'FTDI'].indexOf(p.manufacturer) >= 0);
    // console.log(ports);
    return ports;
  })
  .then((possibleEggPorts) => {
    possibleEggPorts.forEach((p) => {
      let once = true;
      let bufferedData = `Port: ${p.comName}\r\n\r\n`;
      bufferedData = bufferedData.concat(moment().subtract(1, 'second').format() + ',egg');
      let serialNumber;
      let outputStream;
      let lineBuffer = "";
      openPort(p.comName)
        .then((port) => {
          let firstData = true;
          const parser = port.pipe(new SerialPort.parsers.ByteLength({ length: 1 }));
          parser.on('data', (data) => {
            data = data.toString();
            if (!serialNumber) {
              bufferedData = bufferedData.concat(data);
              let temp = /[0-9a-f]{12}/.exec(bufferedData);

              if (once) {
                temp = 1;
                once = false;
              }
              if (temp) {
                serialNumber = 'kwj-data-' + p.comName.replace(/[\\\/]/g, '-');
                console.log('Creating Write Stream for port ', p.comName);
                outputStream = fs.createWriteStream(`egg${serialNumber}.txt`, { encoding: 'utf8' });
                outputStream.write(bufferedData);

                // set up a process exit handler to gracefully close the stream
                let handle = () => {
                  console.log(`Handling process shutdown for ${serialNumber}`);
                  if (outputStream) {
                    outputStream.end(() => console.log(`Closed ${serialNumber}.txt`));
                    outputStream = null;
                  }

                  if (port) {
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
            else if (outputStream) {
              outputStream.write(data);
            }

            // handle line buffer and console output
            if (data === '\n') {
              const date = moment().subtract(1, 'second').format();
              outputStream.write(date + ',egg');
              console.log(`${date},egg${lineBuffer}`);
              lineBuffer = "";
            }
            else if (data !== '\r') {
              lineBuffer += data;
            }
          });
        })
        .catch((err) => {
          console.error(err, err.stack, err.message);
          if (port) {
            port.close();
          }
        });
    })
  })

// returns a promise that resolves to the opened SerialPort after setting rts/dtr for Egg
// or rejects with an error
let openPort = async (comName) => {
  let port = await new Promise((resolve, reject) => {
    // open the port
    let port = new SerialPort(comName, {
      baudRate: 9600
    }, (err) => {
      if (err) {
        reject(err);
      }
      else {
        console.log(`port ${comName} opened`);
        resolve(port);
      }
    });
  });

  port = await new Promise((resolve, reject) => {
    port.set({ dtr: true, rts: true }, (err) => {
      if (err) {
        reject(err);
      }
      else {
        resolve(port);
      }
    });
  });

  setInterval(() => {
    port.write('\r');
  }, 1000);
};
