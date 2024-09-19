const PORT = 3001;

const axios = require('axios');
const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
const formidable = require('formidable');
const FolderProcessor = require('./folder-processing.js');
const rootStructure = require('./RootStructure.js');

const BASE_URL = 'https://api.q-play.net/';


let ACCOUNT_TOKEN = '', SECRET_TOKEN = '';

async function checkAccountExists() {
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
        //console.log(accounts)

        console.log('Account exists:', accounts.length > 0);

        return accounts;
    } catch (error) {
        console.error('Error fetching accounts:', error.message);
        return false;
    }
}

const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathParts = parsedUrl.pathname.split('/');
    ACCOUNT_TOKEN = req.headers['accounttoken'];
    SECRET_TOKEN = req.headers['secrettoken'];

    if (pathParts[1] !== 'download' && (!ACCOUNT_TOKEN || !SECRET_TOKEN)) {
        res.writeHead(401, { 'Content-Type': 'text/plain' });
        res.end('Unauthorized');
        return;
    }

    const accountExists = await checkAccountExists();
    console.log(accountExists);
    //await downloadFilesAndFolders();


    if (req.method === 'GET' && pathParts[1] === 'create-zip') {
        let folderName = accountExists[0].id;
        await rootStructure(ACCOUNT_TOKEN, SECRET_TOKEN, folderName);

        const folderProcessor = new FolderProcessor();
        folderProcessor.createZipFile(folderName).then((data) => {
            //res.end(`Download Link: http://185.181.165.148:${PORT}/download/` + folderName + '.zip');
            //return json with link and file size from data
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                link: 'http://185.181.165.148:' + PORT + '/download/' + folderName + '.zip',
                fileSize: Math.ceil(data.fileSizeInBytes / 1024 / 1024) + ' MB'
            }));

            //delete the folder
            folderProcessor.deleteFolder(folderName);
        })
        // res.writeHead(404, { 'Content-Type': 'text/plain' });
        // res.end('Not Found');
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








// Folder where ZIP files are stored
const DOWNLOADS_FOLDER = './DOWNLOADS_FOLDER/';


// Delete files older than 1 hour
function deleteOldZipFiles() {
    const ONE_HOUR = 60 * 60 * 1000; // 1 hour in milliseconds
    const now = Date.now();

    // Read all files from the download folder
    fs.readdir(DOWNLOADS_FOLDER, (err, files) => {
        if (err) {
            return console.error(`Unable to scan directory: ${err}`);
        }

        // Loop through each file
        files.forEach(file => {
            // Get full path of the file
            const filePath = path.join(DOWNLOADS_FOLDER, file);

            // Check if the file is a zip file
            if (path.extname(file) === '.zip') {
                // Get the file stats (including modified time)
                fs.stat(filePath, (err, stats) => {
                    if (err) {
                        return console.error(`Unable to get file stats: ${err}`);
                    }

                    // Calculate file age
                    const fileAge = now - stats.mtimeMs;

                    // If the file is older than 1 hour, delete it
                    if (fileAge > ONE_HOUR) {
                        fs.unlink(filePath, (err) => {
                            if (err) {
                                console.error(`Error deleting file ${file}: ${err}`);
                            } else {
                                console.log(`Deleted old zip file: ${file}`);
                            }
                        });
                    }
                });
            }
        });
    });
}

// Run the function every 1 minute
setInterval(deleteOldZipFiles, 10 * 60 * 1000);