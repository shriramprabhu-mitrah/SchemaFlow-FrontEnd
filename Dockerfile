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

# Inject API_URL into the production config at build time
# Railway passes service variables as build args when using Dockerfile builder
ARG API_URL
ARG ENV_NAME=production
RUN if [ -n "$API_URL" ]; then \
      API_URL=$API_URL ENV_NAME=$ENV_NAME node scripts/inject-env.js; \
    else \
      echo "API_URL not set during build — will inject at runtime"; \
    fi

# Ensure the Express server always starts in this container
ENV PORT=4000
ENV RAILWAY_ENVIRONMENT=production
EXPOSE 4000

# Start the SSR server
CMD ["node", "dist/db-diagram/server/server.mjs"]
