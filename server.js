const http = require("node:http");
const url = require("url");
const path = require('path');
const formidable = require("formidable");
const fs = require("node:fs");
const { spawn } = require("node:child_process");
const crypto = require("node:crypto");

const config = require("./config"); // Import the configuration

// maps file extention to MIME types
// full list can be found here: https://www.freeformatter.com/mime-types-list.html
const mimeType = {
  ".ico": "image/x-icon",
  ".html": "text/html",
  ".js": "text/javascript",
  ".json": "application/json",
  ".css": "text/css",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".wav": "audio/wav",
  ".mp3": "audio/mpeg",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
  ".zip": "application/zip",
  ".doc": "application/msword",
  ".eot": "application/vnd.ms-fontobject",
  ".ttf": "application/x-font-ttf",
};

// Function to read HTML file
function readHTMLFile(filename) {
  return new Promise((resolve, reject) => {
    fs.readFile(filename, "utf8", (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(data);
      }
    });
  });
}

const server = http.createServer(async (req, res) => {
  // Parse the URL
  const parsedUrl = url.parse(req.url);
  const pathname = parsedUrl.pathname;

  // Check if the request is for the upload endpoint (matches /upload at the end of the path)
  if (pathname.endsWith("/upload") && req.method.toLowerCase() === "post") {
    const form = new formidable.IncomingForm();

    form.parse(req, (err, fields, files) => {
      if (err) {
        console.error(err);
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end("Error uploading files");
        return;
      }

      const uploadedFile1 = files.file1[0];
      const uploadedFile2 = files.file2[0];

      if (uploadedFile1.originalFilename.split(".").pop().toLowerCase() !== "pdf") {
        res.writeHead(400, { "Content-Type": "text/plain" });
        res.end("Datei 1 muss eine PDF-Datei sein.");
        return;
      }

      if (uploadedFile2.originalFilename.split(".").pop().toLowerCase() !== "js") {
        res.writeHead(400, { "Content-Type": "text/plain" });
        res.end("Datei 2 muss eine JS-Datei sein.");
        return;
      }

      const timestamp = Date.now();
      const uploadDir = `./uploads/${timestamp}`;

      fs.mkdirSync(uploadDir, { recursive: true });

      // SECURITY: Generate random filenames to prevent overwriting and traversal attacks
      const safeName1 = crypto.randomUUID() + ".pdf";
      const safeName2 = crypto.randomUUID() + ".js";
      
      const filePath1 = path.join(uploadDir, safeName1);
      const filePath2 = path.join(uploadDir, safeName2);

      const fileStream1 = fs.createWriteStream(filePath1);
      fs.createReadStream(uploadedFile1.filepath).pipe(fileStream1);

      const fileStream2 = fs.createWriteStream(filePath2);
      fs.createReadStream(uploadedFile2.filepath).pipe(fileStream2);

      let filesSaved = 0;
      const handleFileFinish = async () => {
        filesSaved++;
        if (filesSaved === 2) {
          try {
            // SECURITY: Use spawn instead of exec to prevent Command Injection
            // Arguments are passed as an array, so 'rm -rf /' would just be treated as a filename
            const scriptArgs = ["./JS2PDFInjector/JS2PDFInjector-1.0.jar", filePath1, filePath2];
            
            console.log(`Executing java -jar ${scriptArgs.join(" ")}`);
            
            const child = spawn("java", ["-jar", ...scriptArgs]);

            let stdoutData = "";
            let stderrData = "";

            child.stdout.on("data", (data) => {
              stdoutData += data;
            });

            child.stderr.on("data", (data) => {
              stderrData += data;
            });

            child.on("close", async (code) => {
                if (code !== 0) {
                    console.error(`Process exited with code ${code}`);
                    console.error(`stderr: ${stderrData}`);
                    res.writeHead(500, { "Content-Type": "text/plain" });
                    res.end("Error processing PDF");
                    return;
                }

                console.log(`stdout: ${stdoutData}`);
                
                try {
                    // The Java tool creates a new file. We need to find it.
                    // Usually it prefixes "js_injected_" to the input filename.
                    // Since we renamed the input to a UUID, the output will be "js_injected_UUID.pdf"
                    
                    const outputFilename = `js_injected_${safeName1}`;
                    const outputFilePath = path.join(uploadDir, outputFilename);
                    
                    // Verify the file actually exists
                    if (!fs.existsSync(outputFilePath)) {
                         console.error("Output file not found:", outputFilePath);
                         // Fallback: Check if the tool output the filename (stdout) and use that if it differs
                         // But for now, rely on standard naming convention of the tool
                         res.writeHead(500, { "Content-Type": "text/plain" });
                         res.end("Error: Output file was not created.");
                         return;
                    }

                    // For the user, we can make the download link look nicer or just use the system name
                    // The 'download' attribute in HTML allows specifying a friendly name
                    const originalNameNoExt = path.parse(uploadedFile1.originalFilename).name;
                    const downloadName = `injected_${originalNameNoExt}.pdf`;

                    // Construct the URL path to the file
                    // We need to serve this file via the static file handler
                    // The path on disk is ./uploads/timestamp/filename
                    // The URL should be .../uploads/timestamp/filename
                    
                    // Note: Our static handler expects /uploads/...
                    const downloadUrl = `uploads/${timestamp}/${outputFilename}`;

                    const html = await readHTMLFile("./upload-success.html");
                    const htmlWithDownload = html.replace(
                        "FILE_URL",
                        `<p><a href="${downloadUrl}" download="${downloadName}" class="btn btn-success">Ausgabe PDF-Datei herunterladen</a></p>`
                    );

                    res.writeHead(200, { "Content-Type": "text/html" });
                    res.end(htmlWithDownload);

                } catch (err) {
                    console.error(err);
                    res.writeHead(500, { "Content-Type": "text/plain" });
                    res.end("Error loading success page");
                }
            });

          } catch (err) {
            console.error(err);
            res.writeHead(500, { "Content-Type": "text/plain" });
            res.end("Error starting process");
          }
        }
      };

      fileStream1.on("finish", handleFileFinish);
      fileStream2.on("finish", handleFileFinish);

      fileStream1.on("error", (err) => {
        console.error(err);
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end("Error saving file 1");
      });

      fileStream2.on("error", (err) => {
        console.error(err);
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end("Error saving file 2");
      });
    });
  } else if ( (req.url.indexOf("/uploads/")>=0) && req.method.toLowerCase() === "get") {
    console.log(`${req.method} ${req.url}`);

    // Extract the path part starting from /uploads/
    // This allows the app to be served under a subpath (e.g. /pdfinject/uploads/...)
    const uploadIndex = req.url.indexOf("/uploads/");
    const relativePath = req.url.substring(uploadIndex);

    // Avoid Directory traversal
    const sanitizePath = path
      .normalize(relativePath)
      .replace(/^(\.\.[\/\\])+/, "");
      
    let localPathname = path.join(__dirname, sanitizePath);

    fs.exists(localPathname, function (exist) {
      if (!exist) {
        // if the file is not found, return 404
        res.statusCode = 404;
        res.end(`File ${localPathname} not found!`);
        return;
      }

      // if is a directory, then look for index.html
      if (fs.statSync(localPathname).isDirectory()) {
        localPathname += "/index.html";
      }

      // read file from file system
      fs.readFile(localPathname, function (err, data) {
        if (err) {
          res.statusCode = 500;
          res.end(`Error getting the file: ${err}.`);
        } else {
          // based on the URL path, extract the file extention. e.g. .js, .doc, ...
          const ext = path.parse(localPathname).ext;
          // if the file is found, set Content-type and send data
          res.setHeader("Content-type", mimeType[ext] || "text/plain");
          res.end(data);
        }
      });
    });
  } else {
    try {
      const html = await readHTMLFile("./upload-form.html");
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(html);
    } catch (err) {
      console.error(err);
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("Error loading form");
    }
  }
});

server.listen(config.port, config.hostname, () => {
  console.log(`Server running at http://${config.hostname}:${config.port}/`);
});
