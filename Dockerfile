# Backend + Frontend tek konteynerde: Express hem API'yi hem de
# Frontend/public klasorundeki statik sayfalari sunar.
FROM node:20-alpine

WORKDIR /app

COPY Backend/package.json Backend/package-lock.json ./Backend/
RUN cd Backend && npm ci --omit=dev

COPY Backend ./Backend
COPY Frontend ./Frontend

WORKDIR /app/Backend
EXPOSE 3000
CMD ["node", "server.js"]
