/**
 * You can change following variables
 */
const BASE_FOLDER = './BASE_FOLDER/';
const DOWNLOADS_FOLDER = './DOWNLOADS_FOLDER/';
const COMPRESSION_LEVEL = 1;//1 is fastest but low compression, 9 is slowest but highest compression. 0 means no compression. Default is 6

/**End */






const fs = require('fs');
const path = require('path');
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
    createZipFile(folderName) {
        this.downloadsFolder();

        return new Promise((resolve, reject) => {
            console.log(`Folder ${folderName} created`)

            

            const zipFilePath = DOWNLOADS_FOLDER + folderName + '.zip';

            const output = fs.createWriteStream(zipFilePath);

            const archive = archiver('zip', {
                zlib: { level: COMPRESSION_LEVEL } // Sets the compression level.
            });

            output.on('close', () => {
                console.log(archive.pointer() + ' total bytes');
                console.log('Archiver has been finalized and the output file descriptor has closed.');
    
                // Fetch the ZIP file size after the archiving process is complete
                const stats = fs.statSync(zipFilePath);
                const fileSizeInBytes = stats.size;
    
                console.log(`ZIP file size: ${fileSizeInBytes} bytes`);
    
                resolve({ zipFilePath, fileSizeInBytes });
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

    deleteFolder(folderName) {

        return new Promise((resolve, reject) => {
            fs.rmdir(path.join(BASE_FOLDER, ""+folderName), { recursive: true }, (err) => {
                if (err) {
                    reject(err);
                } else {
                    console.log(`Folder ${folderName} deleted`);
                    resolve();
                }
            });
        });

    }
}

module.exports = FolderProcessor