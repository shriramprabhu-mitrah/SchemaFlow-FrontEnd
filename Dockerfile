# Use the exact Node version Angular CLI wants
FROM node:24.15.0-alpine

# Set working directory
WORKDIR /app

# Copy package files AND .npmrc for peer-deps config, then install
COPY package*.json .npmrc ./
RUN npm ci

# Copy the rest of the application
COPY . .

# Build the Angular application
RUN npm run build

# We inject API_URL at runtime so the exact same image can be promoted across environments
RUN echo "API_URL will be injected at runtime before starting the server"

# Ensure the Express server always starts in this container
ENV PORT=4000
ENV RAILWAY_ENVIRONMENT=production
EXPOSE 4000

# Start the SSR server, but run injection script first to replace API_URL
CMD node scripts/inject-env.js && node dist/db-diagram/server/server.mjs
