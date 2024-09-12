/**
 * You can change following variables
 */
const BASE_FOLDER = './BASE_FOLDER/';
const DOWNLOADS_FOLDER = './DOWNLOADS_FOLDER/';
const COMPRESSION_LEVEL = 6;//1 is fastest but low compression, 9 is slowest but highest compression. 0 means no compression. Default is 6

/**End */






const fs = require('fs');
const archiver = require('archiver');
class FolderProcessor {

    constructor() {
        console.log('FolderProcessor created')
    }

    downloadsFolder(){
        if(!fs.existsSync(DOWNLOADS_FOLDER)){
            fs.mkdirSync(DOWNLOADS_FOLDER);
        }
        return DOWNLOADS_FOLDER;
    }
    createFolder(folderName) {
        return new Promise((resolve, reject) => {
            console.log(`Folder ${folderName} created`)
            try {
                try {
                    fs.mkdirSync(BASE_FOLDER + folderName);
                    resolve(folderName)
                } catch (err) {
                    console.log('1- Base folder doesn\'t exists');
                    console.log('2- Creating base folder');
                    fs.mkdirSync(BASE_FOLDER);
                    fs.mkdirSync(BASE_FOLDER + folderName);
                    resolve(folderName)
                }

            } catch (err) {
                console.log('Error creating folder')
                //console.log(err)
                if (err.code === 'EEXIST') {
                    resolve(folderName)
                }
                reject('Error creating folder')
            }

        });
    }
    uploadFile(folderName, fileName, oldPath) {

        return new Promise(async (resolve, reject) => {


            if (!fs.existsSync(BASE_FOLDER + folderName)) {
                //create folder
                await this.createFolder(folderName)
            }

            fs.copyFile(oldPath, BASE_FOLDER + folderName + '\\' + fileName, (err) => {
                if (err) {
                    reject(err);
                }

                fs.unlink(oldPath, (err) => {
                    if (err) {
                        reject(err);
                    }

                    resolve(BASE_FOLDER + folderName + '\\' + fileName);
                });
            });

        });

    }
    createZipFile(folderName) {
        this.downloadsFolder();

        return new Promise((resolve, reject) => {
            console.log(`Folder ${folderName} created`)

            

            const output = fs.createWriteStream(DOWNLOADS_FOLDER + folderName + '.zip');

            const archive = archiver('zip', {
                zlib: { level: COMPRESSION_LEVEL } // Sets the compression level.
            });

            output.on('close', () => {
                console.log(archive.pointer() + ' total bytes');
                console.log('archiver has been finalized and the output file descriptor has closed.');
                resolve(DOWNLOADS_FOLDER + folderName + '.zip');
            });

            output.on('end', () => {
                console.log('Data has been drained');
            });

            archive.on('error', (err) => {  
                reject(err);
            });

            archive.pipe(output);

            archive.directory(BASE_FOLDER + folderName, false);
            archive.finalize();
        });

    }
}

module.exports = FolderProcessor