<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        try {
            if (\Illuminate\Support\Facades\Schema::hasTable('document_requests')) {
                if (!\Illuminate\Support\Facades\Schema::hasColumn('document_requests', 'purok_certificate_photo')) {
                    \Illuminate\Support\Facades\DB::statement("ALTER TABLE document_requests ADD COLUMN purok_certificate_photo LONGTEXT NULL");
                }
                if (!\Illuminate\Support\Facades\Schema::hasColumn('document_requests', 'extra_fields')) {
                    \Illuminate\Support\Facades\DB::statement("ALTER TABLE document_requests ADD COLUMN extra_fields LONGTEXT NULL");
                }
                if (!\Illuminate\Support\Facades\Schema::hasColumn('document_requests', 'barangay')) {
                    \Illuminate\Support\Facades\DB::statement("ALTER TABLE document_requests ADD COLUMN barangay VARCHAR(100) DEFAULT 'Pianing'");
                }
            }
        } catch (\Throwable $e) {
            // Non-blocking in case DB is offline or during pre-migration artisan calls
        }
    }
}
