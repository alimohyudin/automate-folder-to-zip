const PORT = 3001;

const axios = require('axios');
const http = require('http');
const url = require('url');
const fs = require('fs');
const formidable = require('formidable');
const FolderProcessor = require('./folder-processing.js');

const BASE_URL = 'https://api.q-play.net/';

let ACCOUNT_TOKEN = 'cTInxnqprVqj32c9DHesDOkSM7cRURF35e70df4e97a81', SECRET_TOKEN = 'CJKKf52WOJPFbyWi2FAKl6zNqmck3fE266e41906b7ced';

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

        //at /folders get list of folders
        const folders = await axios.get('https://api.q-play.net/folders?accountID=1&page=1&perPage=1000', {
            headers: {
                AccountToken: ACCOUNT_TOKEN,
                SecretToken: SECRET_TOKEN
            }
        })

        console.log('Folders:', folders.data);
        
        //console.log(folders.data);
        //at /files get list of files


        //creat folder with post request
        // const folders = await axios.post('https://api.q-play.net/folders', {
        //     name: 'another test folder'
        // }, {
        //     headers: {
        //         AccountToken: ACCOUNT_TOKEN,
        //         SecretToken: SECRET_TOKEN
        //     }
        // })

        // console.log('Folders:', folders.data);


        return accounts;
    } catch (error) {
        console.error('Error fetching accounts:', error.message);
        return false;
    }
}

async function downloadFilesAndFolders(folderPath = '', downloadDir = 'downloads') {
    // Make API call to get the folder structure or files
    try {
      const response = await axios.get(`${BASE_URL}/${folderPath}`, {
        headers: {
            AccountToken: ACCOUNT_TOKEN,
            SecretToken: SECRET_TOKEN
        }
    });
      const items = response.data; // Assuming response is an array of folders and files

      console.log(`Downloaded ${items.length} items from ${folderPath}`);
      console
  
      for (let item of items) {
        const itemPath = path.join(downloadDir, folderPath, item.name);
  
        if (item.type === 'folder') {
          // Create the folder locally
          await fs.ensureDir(itemPath);
          // Recursively download the contents of the folder
          await downloadFilesAndFolders(path.join(folderPath, item.name), downloadDir);
        } else if (item.type === 'file') {
          // Download and save the file
          const fileResponse = await axios({
            url: `${BASE_URL}/${folderPath}/${item.name}`,
            method: 'GET',
            responseType: 'stream',
            headers: {
                AccountToken: ACCOUNT_TOKEN,
                SecretToken: SECRET_TOKEN
            }
          });
  
          const writer = fs.createWriteStream(itemPath);
          fileResponse.data.pipe(writer);
  
          // Wait for the file to finish downloading
          await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
          });
        }
      }
    } catch (error) {
      console.error(`Failed to download ${folderPath}:`, error.message);
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
    //await downloadFilesAndFolders();


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
            res.end(`Download Link: http://31.222.235.214:${PORT}/download/` + customerId + '.zip');
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

// server.listen(PORT, () => {
//     console.log(`Server running at http://localhost:${PORT}/`);
// });

checkAccountExists();
