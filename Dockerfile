# Stage 1: Build the React Single Page Application (SPA)
FROM node:20-alpine AS frontend-builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Unified Production Runtime (PHP 8.2 + Node.js)
FROM php:8.2-cli-alpine
WORKDIR /app

# Install system dependencies, Node.js, npm, and required PHP extensions
RUN apk add --no-cache \
    nodejs \
    npm \
    git \
    curl \
    libzip-dev \
    libpng-dev \
    libjpeg-turbo-dev \
    freetype-dev \
    oniguruma-dev \
    && docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install pdo pdo_mysql mbstring gd

# Install Composer from official Composer binary image
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

# Copy application source code
COPY . .

# Copy compiled frontend from frontend-builder
COPY --from=frontend-builder /app/dist ./dist
COPY --from=frontend-builder /app/public ./public

# Install composer dependencies for production and node dependencies for migration script
RUN composer install --no-dev --optimize-autoloader --no-interaction \
    && npm install --omit=dev

# Ensure storage, cache, and database directories exist and have write permissions
RUN mkdir -p storage/framework/views storage/framework/cache/data storage/framework/sessions storage/logs bootstrap/cache \
    && chmod -R 777 storage bootstrap/cache database

# Expose default port
EXPOSE 5000

# Start command: execute database migrations & seed into Railway MySQL, then serve app
CMD ["sh", "-c", "node server/migrate.js && php artisan serve --host=0.0.0.0 --port=${PORT:-5000}"]
