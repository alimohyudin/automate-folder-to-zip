# Simple NodeJS Server to Upload and Convert Folder to Zip

This is a simple nodejs server that has two endpoints. One is to upload a file with a customer id and the other is to convert the customer folder and create a download link.

## Installation

1. Clone the repository
2. Run `npm install` to install the dependencies
3. Run `node server.js` to start the server

## Endpoints


### Convert Customer Folder and Create Download Link

* Endpoint: `GET /create-zip`
* Header: `Provide AccessToken & SecretToken`
* Response: a download link for the customer folder

## Example

### Convert Customer Folder and Create Download Link

* `curl -X GET http://localhost:3001/create-zip`
* Response: `Download Link: http://localhost:3001/download/12345.zip`