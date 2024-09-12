const PORT = 3001;

const http = require('http');
const url = require('url');
const fs = require('fs');
const formidable = require('formidable');
const FolderProcessor = require('./folder-processing.js');


const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathParts = parsedUrl.pathname.split('/');


    if (req.method === 'POST' && pathParts[1] === 'upload-file' && pathParts[2]) {
        const customerId = pathParts[2];

        const form = new formidable.IncomingForm();

        form.parse(req, (err, fields, files) => {
            if (err) {
                console.error(err);
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('Internal Server Error');
                return;
            }

            const uploadedFile = files.file[0];
            const filename = uploadedFile.originalFilename;
            const oldPath = uploadedFile.filepath;

            const folderProcessor = new FolderProcessor();
            folderProcessor.uploadFile(customerId, filename, oldPath).then(() => {
                res.writeHead(200, { 'Content-Type': 'text/plain' });
                res.end('File uploaded successfully');
            })
                .catch((err) => {
                    console.error(err);
                    res.writeHead(500, { 'Content-Type': 'text/plain' });
                    res.end('Internal Server Error');
                });
        });
    } else if (req.method === 'GET' && pathParts[1] === 'create-zip' && pathParts[2]) {
        const customerId = pathParts[2];
        const folderProcessor = new FolderProcessor();
        folderProcessor.createZipFile(customerId).then(() => {
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end(`Download Link: http://localhost:${PORT}/download/` + customerId + '.zip');
        })
    } else if (req.method === 'GET' && pathParts[1] === 'download' && pathParts[2]) {
        const customerId = pathParts[2];
        const folderProcessor = new FolderProcessor();
        let DOWNLOADS_FOLDER = folderProcessor.downloadsFolder();
        let filePath = DOWNLOADS_FOLDER + customerId ;
        fs.access(filePath, fs.constants.F_OK, (err) => {

            if (err) {
                console.log(err);
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('File not found');
                return;
            }

            res.writeHead(200, {
                'Content-Type': 'application/octet-stream',
                'Content-Disposition': `attachment; filename="${customerId}"`
            });

            const readStream = fs.createReadStream(filePath);

            readStream.pipe(res);
        });
    } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
    }
});

server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}/`);
});
