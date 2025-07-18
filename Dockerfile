# Stage: Serve pre-built React app with Nginx
FROM nginx:1.23-alpine

# Remove default Nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy build output (from host machine)
COPY build /usr/share/nginx/html

# Custom Nginx config and config injection script
COPY nginx.conf /etc/nginx/conf.d/
COPY inject-config.sh /docker-entrypoint.d/
RUN chmod +x /docker-entrypoint.d/inject-config.sh

EXPOSE 80
CMD ["sh", "-c", "/docker-entrypoint.d/inject-config.sh && nginx -g 'daemon off;'"]
