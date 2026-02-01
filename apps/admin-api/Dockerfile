FROM node:18-alpine

WORKDIR /usr/src/app


COPY . .
RUN npm ci --only=production && \ 
    npm run build:admin

EXPOSE 3000

CMD ["node", "dist/apps/admin-api/apps/admin-api/src/main.js"]