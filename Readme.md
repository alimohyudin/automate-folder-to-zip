# Simple NodeJS Server to Upload and Convert Folder to Zip

This is a simple nodejs server that has two endpoints. One is to upload a file with a customer id and the other is to convert the customer folder and create a download link.

## Installation

1. Clone the repository
2. Run `npm install` to install the dependencies
3. Run `node server.js` to start the server

## Endpoints

### Upload a File with Customer ID

* Endpoint: `POST /upload-file/:customerId`
* Request Body: a file to be uploaded
* Response: a success message

### Convert Customer Folder and Create Download Link

* Endpoint: `GET /create-zip/:customerId`
* Response: a download link for the customer folder

## Example

### Upload a File with Customer ID

* `curl -X POST -F "file=@/path/to/file" http://localhost:3001/upload-file/12345`

### Convert Customer Folder and Create Download Link

* `curl -X GET http://localhost:3001/create-zip/12345`
* Response: `Download Link: http://localhost:3001/download/12345.zip`