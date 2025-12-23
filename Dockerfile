FROM node:20-slim

# Install all dependencies for pdf2pic (GraphicsMagick + Ghostscript) and sharp
RUN apt-get update && apt-get install -y \
    graphicsmagick \
    ghostscript \
    libgs-dev \
    fonts-liberation \
    fonts-dejavu-core \
    fontconfig \
    libvips-dev \
    build-essential \
    python3 \
    && rm -rf /var/lib/apt/lists/* \
    && fc-cache -f -v

# Install pnpm
RUN npm install -g pnpm

WORKDIR /app

# Copy package files and patches (patches needed for pnpm install)
COPY package.json pnpm-lock.yaml ./
COPY patches ./patches/

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
