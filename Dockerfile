FROM mcr.microsoft.com/playwright:v1.40.0-jammy

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Run the scheduler by default
CMD ["npx", "ts-node", "--compiler-options", "{\"module\":\"commonjs\",\"esModuleInterop\":true}", "scheduler.ts"]
