const axios = require('axios');
const fs = require('fs');
const path = require('path');
const finished = require('finished');


const API_BASE_URL = 'https://api.q-play.net';
const PAGE_LIMIT = 100;
const outputDir = './BASE_FOLDER';

let ACCOUNT_TOKEN = '', SECRET_TOKEN = '';


async function fetchPaginatedData(url, isFolders = false) {
    let page = 1;
    let hasMore = true;
    const results = [];

    try {
        while (hasMore) {
            console.log(`Fetching url ${url}`);
            const response = await axios.get(`${url}&page=${page}&perPage=${PAGE_LIMIT}`, {
                headers: {
                    AccountToken: ACCOUNT_TOKEN,
                    SecretToken: SECRET_TOKEN
                }
            });
            const data = response.data;
            console.log(data);

            if (data.pagination.totalResults === 0) {
                break;
            }
            if (isFolders) {
                results.push(...data.folders);
                hasMore = data.pagination.totalResults > results.length;
                page++;
            }
            else {
                results.push(...data.users);
                hasMore = data.pagination.totalResults > results.length;
                page++;
            }
        }
    }
    catch (error) {
        console.log(error);
        //console.log(error);
        //console.error('Error fetching paginated data:', error);
    }

    return results;
}

async function fetchAllFolders() {
    const url = `${API_BASE_URL}/folders?filter=`;
    return await fetchPaginatedData(url, true);
}

async function fetchFiles() {
    const url = `${API_BASE_URL}/files?filter=`;
    return await fetchPaginatedData(url);
}

function filterFiles(files, folderID) {
    //return files.filter(file => file.folderID === folderID);
    return files.filter(file => file.folderID === folderID).map(file => { return { id: file.id, name: file.name } })
}
async function buildFolderTree(folders, allFiles, parentFolderID = -1) {
    const tree = [];
    const currentFolders = folders.filter(folder => folder.parentFolderID === parentFolderID);

    for (const folder of currentFolders) {
        //const files = await fetchFiles(folder.id);

        /* tree[folder.id + " - " + folder.name] = {
            files: filterFiles(allFiles, folder.id),
            folders: await buildFolderTree(folders, allFiles, folder.id) // recursively fetch subfolders
        }; */
        tree.push({
            id: folder.id,
            name: folder.name,
            files: filterFiles(allFiles, folder.id),
            folders: await buildFolderTree(folders, allFiles, folder.id)
        })
    }

    return tree;
}

async function downloadFile(fileId, dest) {
    try {
        // Get the signed URL from the API
        const response = await axios.get(`https://api.q-play.net/files/${fileId}`, {
            headers: {
                AccountToken: ACCOUNT_TOKEN,
                SecretToken: SECRET_TOKEN
            }
        });
        const signedUrl = response.data.file.signedUrl;
        console.log(`Signed URL: ${signedUrl}`);
        // Prepare the writer stream
        const writer = fs.createWriteStream(dest);

        // Download the file
        const fileStream = (await axios.get(signedUrl, { responseType: 'stream' })).data;
        fileStream.pipe(writer);

        // Wait for the file to be fully written
        await new Promise((resolve, reject) => {
            finished(writer, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        //sleep for 5 seconds
        await new Promise(resolve => setTimeout(resolve, 500));

        console.log(`Downloaded ${dest}`);
    } catch (error) {
        console.error(`Failed to download file ${fileId}:`, error.message);
    }
}
async function createStructure(dir, structure) {
    // Create files
    if (structure.files) {
        for (const file of structure.files) {
            const filePath = path.join(dir, file.name);
            await downloadFile(file.id, filePath); // Download the file
        }
    }

    // Create folders
    if (structure.folders) {
        for (const folder of structure.folders) { // Replace forEach with for...of
            const newDir = path.join(dir, folder.name);
            fs.mkdirSync(newDir, { recursive: true });
            await createStructure(newDir, folder); // Recursive call
        }
    }
}

// Main function to start the process
async function main(accessToken, secretToken, folderName) {
    ACCOUNT_TOKEN = accessToken;
    SECRET_TOKEN = secretToken;
    try {
        const allFolders = await fetchAllFolders();

        const allFiles = await fetchFiles();

        const rootFoldersTree = await buildFolderTree(allFolders, allFiles, -1);

        const finalTree = {
            files: filterFiles(allFiles, -1),
            folders: rootFoldersTree // Root folders and their subfolders
        };

        console.log("===================OUTPUT===================");
        console.log(JSON.stringify(finalTree, null, 2));

        //write finaltree to file
        // fs.writeFileSync('allFolders.json', JSON.stringify(allFolders, null, 2));
        // fs.writeFileSync('allFiles.json', JSON.stringify(allFiles, null, 2));
        // fs.writeFileSync('finaltree.json', JSON.stringify(finalTree, null, 2));
        /* end */


        fs.mkdirSync(outputDir + '/' + folderName, { recursive: true });

        await createStructure(outputDir + '/' + folderName, finalTree);
    } catch (error) {
        console.error('Error building folder tree:', error);
    }
}

//main();

module.exports = main