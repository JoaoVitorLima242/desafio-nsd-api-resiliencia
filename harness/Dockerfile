FROM node:22-alpine
WORKDIR /app
COPY package.json ./
COPY load.js verify.js ./
COPY scenarios ./scenarios
# Sem npm install: o harness não tem dependências externas.
CMD ["node", "--version"]
