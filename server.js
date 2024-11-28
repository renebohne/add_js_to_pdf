const http = require('node:http');
const formidable = require('formidable');
const fs = require('node:fs');
const { exec } = require('node:child_process');

const config = require('./config'); // Import the configuration


// Function to read HTML file
function readHTMLFile(filename) {
  return new Promise((resolve, reject) => {
    fs.readFile(filename, 'utf8', (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(data);
      }
    });
  });
}

const server = http.createServer(async (req, res) => {
  if (req.url === '/upload' && req.method.toLowerCase() === 'post') {
    const form = new formidable.IncomingForm();

    form.parse(req, (err, fields, files) => {
      if (err) {
        console.error(err);
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Error uploading files');
        return;
      }

      const uploadedFile1 = files.file1[0];
      const uploadedFile2 = files.file2[0];

      if (uploadedFile1.originalFilename.split('.').pop() !== 'pdf') {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('Datei 1 muss eine PDF-Datei sein.');
        return;
      }

      if (uploadedFile2.originalFilename.split('.').pop() !== 'js') {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('Datei 2 muss eine JS-Datei sein.');
        return;
      }

      const timestamp = Date.now();
      const uploadDir = `./uploads/${timestamp}`;

      fs.mkdirSync(uploadDir, { recursive: true });

      const fileStream1 = fs.createWriteStream(`${uploadDir}/${uploadedFile1.originalFilename}`);
      fs.createReadStream(uploadedFile1.filepath).pipe(fileStream1);

      const fileStream2 = fs.createWriteStream(`${uploadDir}/${uploadedFile2.originalFilename}`);
      fs.createReadStream(uploadedFile2.filepath).pipe(fileStream2);

      let filesSaved = 0;
      const handleFileFinish = async () => {
        filesSaved++;
        if (filesSaved === 2) {
          try {
            const filePaths = [
              `${uploadDir}/${uploadedFile1.originalFilename}`,
              `${uploadDir}/${uploadedFile2.originalFilename}`
            ];

            const scriptPath = './your-script.sh';
            const command = `${scriptPath} ${filePaths.join(' ')}`;

            exec(command, async (error, stdout, stderr) => {
              if (error) {
                console.error(`Error executing script: ${error}`);
                return;
              }
              console.log(`stdout: ${stdout}`);
              console.error(`stderr: ${stderr}`);

              try {
                // Assuming your script outputs the new filename to stdout
                const newFileName = stdout.trim(); 
                const newFilePath = `${uploadDir}/${newFileName}`;

                const html = await readHTMLFile('./upload-success.html');
                const htmlWithDownload = html.replace(
                  '',
                  `<p><a href="${newFilePath}" download>Download the generated file</a></p>`
                );

                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(htmlWithDownload);
              } catch (err) {
                console.error(err);
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('Error loading success page');
              }
            });

          } catch (err) {
            console.error(err);
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Error loading success page');
          }
        }
      };

      fileStream1.on('finish', handleFileFinish);
      fileStream2.on('finish', handleFileFinish);

      fileStream1.on('error', (err) => {
        console.error(err);
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Error saving file 1');
      });

      fileStream2.on('error', (err) => {
        console.error(err);
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Error saving file 2');
      });
    });
  } else {
    try {
      const html = await readHTMLFile('./upload-form.html');
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(html);
    } catch (err) {
      console.error(err);
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Error loading form');
    }
  }
});

server.listen(config.port, config.hostname, () => {
    console.log(`Server running at http://${config.hostname}:${config.port}/`);
  });