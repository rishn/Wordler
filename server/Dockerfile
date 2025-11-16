# Use Playwright's official image (includes browsers + system deps)
FROM mcr.microsoft.com/playwright:v1.49.0-jammy

ENV NODE_ENV=production \
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

WORKDIR /usr/src/app

# Install dependencies (include dev to allow TypeScript build)
COPY package*.json ./
RUN npm ci --include=dev

# Copy server sources and build
COPY . ./
RUN npm run build

# Expose the port (server defaults to 4000 if PORT not set)
EXPOSE 4000

# Start the server (uses "start": "node dist/index.js")
CMD ["npm", "start"]
