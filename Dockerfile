FROM node:20.15-slim

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy only package.json and package-lock.json first
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy the rest of the application files
COPY . .

# Expose the application's port
EXPOSE 3001

# Start the application
CMD ["node", "server.js"]
