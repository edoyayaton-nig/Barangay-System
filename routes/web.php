<?php

use Illuminate\Support\Facades\Route;

// Favicon handler to prevent 404 console errors
Route::get('/favicon.ico', function () {
    $iconPath = public_path('assets/pianing-logo.png');
    if (!file_exists($iconPath)) {
        $iconPath = base_path('dist/assets/pianing-logo.png');
    }
    if (file_exists($iconPath)) {
        return response(file_get_contents($iconPath), 200, [
            'Content-Type' => 'image/png',
            'Cache-Control' => 'public, max-age=86400',
        ]);
    }
    return response('', 204);
});

// Serve public uploads (photos, resident IDs, document attachments)
Route::get('/uploads/{filename}', function ($filename) {
    $path = public_path('uploads/' . $filename);
    if (!file_exists($path)) {
        $path = base_path('server/uploads/' . $filename);
    }
    if (file_exists($path)) {
        $ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));
        $mime = match ($ext) {
            'png' => 'image/png',
            'jpg', 'jpeg' => 'image/jpeg',
            'webp' => 'image/webp',
            'gif' => 'image/gif',
            'pdf' => 'application/pdf',
            default => 'application/octet-stream',
        };
        return response(file_get_contents($path), 200, ['Content-Type' => $mime]);
    }
    // Graceful fallback for missing profile photos/images: return 1x1 transparent PNG to prevent console 404s
    if (preg_match('/\.(jpg|jpeg|png|webp|gif)$/i', $filename)) {
        return response(base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='), 200, [
            'Content-Type' => 'image/png',
            'Cache-Control' => 'no-cache',
        ]);
    }
    abort(404, 'File not found');
});

// Serve frontend assets (compiled JS, CSS, images) from public/assets or dist/assets
Route::get('/assets/{file}', function ($file) {
    $path = public_path('assets/' . $file);
    if (!file_exists($path)) {
        $path = base_path('dist/assets/' . $file);
    }
    if (file_exists($path)) {
        $ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));
        $mime = match ($ext) {
            'js', 'mjs' => 'application/javascript; charset=UTF-8',
            'css' => 'text/css; charset=UTF-8',
            'svg' => 'image/svg+xml',
            'png' => 'image/png',
            'jpg', 'jpeg' => 'image/jpeg',
            'webp' => 'image/webp',
            'gif' => 'image/gif',
            'ico' => 'image/x-icon',
            'json' => 'application/json',
            'woff' => 'font/woff',
            'woff2' => 'font/woff2',
            'ttf' => 'font/ttf',
            default => 'application/octet-stream',
        };
        return response(file_get_contents($path), 200, [
            'Content-Type' => $mime,
            'Cache-Control' => 'public, max-age=31536000, immutable',
        ]);
    }
    abort(404, 'Asset not found');
})->where('file', '.*');

// Single-Runtime React SPA Wildcard Fallback Route
// Any route not matching /api/... serves the compiled React application
Route::get('/{any?}', function () {
    $indexPath = public_path('index.html');
    if (!file_exists($indexPath)) {
        $indexPath = base_path('dist/index.html');
    }

    if (file_exists($indexPath)) {
        return response(file_get_contents($indexPath), 200, [
            'Content-Type' => 'text/html; charset=UTF-8',
            'Cache-Control' => 'no-cache, no-store, must-revalidate',
        ]);
    }

    return response()->json([
        'system' => 'Smart Barangay Governance & Public Health System',
        'backend' => 'Laravel Framework 12',
        'status' => 'Online',
        'message' => 'React frontend bundle not found. Please run npm run build to generate dist/index.html',
    ]);
})->where('any', '^(?!api/).*');

// Fallback handler for unmatched routes
Route::fallback(function () {
    $indexPath = public_path('index.html');
    if (!file_exists($indexPath)) {
        $indexPath = base_path('dist/index.html');
    }

    if (file_exists($indexPath)) {
        return response(file_get_contents($indexPath), 200, [
            'Content-Type' => 'text/html; charset=UTF-8',
            'Cache-Control' => 'no-cache, no-store, must-revalidate',
        ]);
    }

    abort(404, 'Not Found');
});
