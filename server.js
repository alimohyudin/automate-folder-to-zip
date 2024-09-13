const PORT = 3001;

const axios = require('axios');
const http = require('http');
const url = require('url');
const fs = require('fs');
const formidable = require('formidable');
const FolderProcessor = require('./folder-processing.js');


async function checkAccountExists(ACCOUNT_TOKEN, SECRET_TOKEN) {
    try {
        console.log('Checking if account exists...');
        console.log(ACCOUNT_TOKEN, SECRET_TOKEN)
        // Send a request to the external API
        const response = await axios.get('https://api.q-play.net/accounts', {
            headers: {
                AccountToken: ACCOUNT_TOKEN,
                SecretToken: SECRET_TOKEN
            }
        });

        // Assuming the API returns a list of accounts, you can check if an account exists
        const accounts = response.data.accounts;
        console.log(accounts)


        return accounts;
    } catch (error) {
        console.error('Error fetching accounts:', error.message);
        return false;
    }
}


const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathParts = parsedUrl.pathname.split('/');
    const accountToken = req.headers['accounttoken'];
    const secretToken = req.headers['secrettoken'];

    if (!accountToken || !secretToken) {
        res.writeHead(401, { 'Content-Type': 'text/plain' });
        res.end('Unauthorized');
        return;
    }

    const accountExists = await checkAccountExists(accountToken, secretToken);

    console.log('Account exists:', accountExists);


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
                res.end('File uploaded successfully for '+ accountExists[0]['contactPerson']['name']);
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
        let filePath = DOWNLOADS_FOLDER + customerId;
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
