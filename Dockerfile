FROM node:20-slim

# Install GraphicsMagick, Ghostscript, and other dependencies for pdf2pic
RUN apt-get update && apt-get install -y \
    graphicsmagick \
    ghostscript \
    libgs-dev \
    && rm -rf /var/lib/apt/lists/*

# Install pnpm
RUN npm install -g pnpm

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build the application
RUN pnpm build

# Expose port
EXPOSE 3000

# Set environment
ENV NODE_ENV=production

# Start the application
CMD ["pnpm", "start"]
