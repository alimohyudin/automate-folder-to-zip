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

//v2: qplay
/**
 *
 * Q-play API structure for v2
 */


async function getQPlayV2Token(clientId, clientSecret) {
    const response = await axios.post('https://app.q-play.io/api/rest/v2/oauth/token', null, {
        params: {
            grant_type: 'client_credentials',
            scope: 'api:medialibrary',
            client_id: clientId,
            client_secret: clientSecret
        }
    });

    return response.data.access_token;
}

async function createV2Folder(folderName, token, parentId = null) {
    const url = 'https://app.q-play.io/api/rest/v2/medialibrary/folder';
    const payload = parentId ? { name: folderName, parent_folder_id: parentId } : { name: folderName };

    const response = await axios.post(url, payload, {
        headers: {
            Authorization: `Bearer ${token}`
        }
    });

    return response.data.data.id;
}


const FormData = require('form-data');

async function uploadFileToV2(filePath, folderId, token) {
    const url = 'https://app.q-play.io/api/rest/v2/medialibrary/media';

    const form = new FormData();
    console.log(`Uploading file: ${filePath} to folder ID: ${folderId}`);
    // console.log(fs.createReadStream(filePath));

    form.append('media', fs.createReadStream(filePath));
    if(folderId)
        form.append('folder_id', folderId);

    const response = await axios.post(url, form, {
        headers: {
            ...form.getHeaders(),
            Authorization: `Bearer ${token}`
        }
    });

    return response.data;
}

async function createV2FolderStructureAndUploadFiles(structure, v1Token, v2Token, v1FolderId = -1, v2ParentId = null, folderMap = {}) {
    // Upload files at the current folder level
    if (structure.files && v1FolderId !== -1) {
        const v2FolderId = folderMap[v1FolderId];
        for (const file of structure.files) {
            const tempFilePath = path.join(__dirname, 'temp', `${file.id}_${file.name}`);
            fs.mkdirSync(path.dirname(tempFilePath), { recursive: true });

            // Download from V1
            await downloadFile(file.id, tempFilePath);

            // Upload to V2
            await uploadFileToV2(tempFilePath, v2FolderId, v2Token);
            console.log(`Uploaded '${file.name}' to V2 folder ID ${v2FolderId}`);

            fs.unlinkSync(tempFilePath); // clean up
        }
    }

    // Create folders and recurse
    if (structure.folders) {
        for (const folder of structure.folders) {
            const newV2FolderId = await createV2Folder(folder.name, v2Token, v2ParentId);
            folderMap[folder.id] = newV2FolderId;

            console.log(`Created folder '${folder.name}' (V1 ID: ${folder.id}, V2 ID: ${newV2FolderId})`);

            // Recurse for subfolders
            await createV2FolderStructureAndUploadFiles(folder, v1Token, v2Token, folder.id, newV2FolderId, folderMap);
        }
    }

    // Handle root-level files (if any)
    if (v1FolderId === -1 && structure.files) {
        for (const file of structure.files) {
            const tempFilePath = path.join(__dirname, 'temp', `${file.id}_${file.name}`);
            fs.mkdirSync(path.dirname(tempFilePath), { recursive: true });

            await downloadFile(file.id, tempFilePath);
            await uploadFileToV2(tempFilePath, v2ParentId, v2Token); // null = root
            console.log(`Uploaded root file '${file.name}' to V2 root`);

            fs.unlinkSync(tempFilePath);
        }
    }
}



function printStructure(structure, indent = '') {
    // Print files at the current level
    if (structure.files) {
        for (const file of structure.files) {
            console.log(`${indent}📄 ${file.name}`);
        }
    }

    // Print folders and recursively their contents
    if (structure.folders) {
        for (const folder of structure.folders) {
            console.log(`${indent}📁 ${folder.name}`);
            printStructure(folder, indent + '  ');
        }
    }
}

//end v2

// Main function to start the process
async function main(accessToken, secretToken, V2_CLIENT_ID, v2_CLIENT_SECRET) {
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


        // fs.mkdirSync(outputDir + '/' + folderName, { recursive: true });
        // await createStructure(outputDir + '/' + folderName, finalTree);

        // printStructure(finalTree); // 👈 This now prints instead of downloading
        // let clientId = 'QpPQ8pNWzjhQ8RwUFd8nd4';
        // let clientSecret = 'Nnj7YC4Iycvv2VNwSn7yYs';
        const v2Token = await getQPlayV2Token(V2_CLIENT_ID, v2_CLIENT_SECRET);
        await createV2FolderStructureAndUploadFiles(finalTree, SECRET_TOKEN, v2Token);


    } catch (error) {
        console.error('Error building folder tree:', error);
    }
}

//main();

module.exports = main