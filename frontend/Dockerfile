# Use Nginx Alpine base image for a small, fast static server
FROM nginx:alpine

# Copy all static client files into Nginx public directory
COPY . /usr/share/nginx/html

# Expose Nginx port
EXPOSE 80
