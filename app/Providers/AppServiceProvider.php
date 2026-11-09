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
            static $dbMigrated = false;
            if ($dbMigrated) {
                return;
            }
            $dbMigrated = true;

            // Ensure uploads directories exist for photos and documents
            $pubUploads = public_path('uploads');
            if (!file_exists($pubUploads)) {
                @mkdir($pubUploads, 0777, true);
            }
            @chmod($pubUploads, 0777);

            $srvUploads = base_path('server/uploads');
            if (!file_exists($srvUploads)) {
                @mkdir($srvUploads, 0777, true);
            }
            @chmod($srvUploads, 0777);

            // One-time table schema checks without redundant DDL table locks
            if (\Illuminate\Support\Facades\Schema::hasTable('document_requests')) {
                if (!\Illuminate\Support\Facades\Schema::hasColumn('document_requests', 'purok_certificate_photo')) {
                    try {
                        \Illuminate\Support\Facades\DB::statement("ALTER TABLE document_requests ADD COLUMN purok_certificate_photo LONGTEXT NULL");
                    } catch (\Throwable $e) {}
                }
                if (!\Illuminate\Support\Facades\Schema::hasColumn('document_requests', 'extra_fields')) {
                    try {
                        \Illuminate\Support\Facades\DB::statement("ALTER TABLE document_requests ADD COLUMN extra_fields LONGTEXT NULL");
                    } catch (\Throwable $e) {}
                }
                if (!\Illuminate\Support\Facades\Schema::hasColumn('document_requests', 'barangay')) {
                    try {
                        \Illuminate\Support\Facades\DB::statement("ALTER TABLE document_requests ADD COLUMN barangay VARCHAR(100) DEFAULT 'Pianing'");
                    } catch (\Throwable $e) {}
                }
            }

            if (\Illuminate\Support\Facades\Schema::hasTable('health_appointments')) {
                $apptCols = [
                    'booking_sms_sent' => "TINYINT(1) NOT NULL DEFAULT 0",
                    'approval_sms_sent' => "TINYINT(1) NOT NULL DEFAULT 0",
                    'completion_sms_sent' => "TINYINT(1) NOT NULL DEFAULT 0",
                    'cancellation_sms_sent' => "TINYINT(1) NOT NULL DEFAULT 0",
                    'three_day_alert_sent' => "TINYINT(1) NOT NULL DEFAULT 0",
                    'one_day_alert_sent' => "TINYINT(1) NOT NULL DEFAULT 0",
                    'sms_sent' => "TINYINT(1) NOT NULL DEFAULT 0",
                ];
                foreach ($apptCols as $col => $def) {
                    if (!\Illuminate\Support\Facades\Schema::hasColumn('health_appointments', $col)) {
                        try {
                            \Illuminate\Support\Facades\DB::statement("ALTER TABLE health_appointments ADD COLUMN `{$col}` {$def}");
                        } catch (\Throwable $e) {}
                    }
                }
            }

            // Ensure complete address fields & barangay code in residents & users
            if (\Illuminate\Support\Facades\Schema::hasTable('residents')) {
                if (!\Illuminate\Support\Facades\Schema::hasColumn('residents', 'province')) {
                    try {
                        \Illuminate\Support\Facades\DB::statement("ALTER TABLE residents ADD COLUMN province VARCHAR(100) DEFAULT 'Agusan del Norte'");
                    } catch (\Throwable $e) {}
                }
                if (!\Illuminate\Support\Facades\Schema::hasColumn('residents', 'zip_code')) {
                    try {
                        \Illuminate\Support\Facades\DB::statement("ALTER TABLE residents ADD COLUMN zip_code VARCHAR(20) DEFAULT '8600'");
                    } catch (\Throwable $e) {}
                }
            }

            if (\Illuminate\Support\Facades\Schema::hasTable('users')) {
                if (!\Illuminate\Support\Facades\Schema::hasColumn('users', 'purok')) {
                    try {
                        \Illuminate\Support\Facades\DB::statement("ALTER TABLE users ADD COLUMN purok VARCHAR(50) DEFAULT '1'");
                    } catch (\Throwable $e) {}
                }
                if (!\Illuminate\Support\Facades\Schema::hasColumn('users', 'province')) {
                    try {
                        \Illuminate\Support\Facades\DB::statement("ALTER TABLE users ADD COLUMN province VARCHAR(100) DEFAULT 'Agusan del Norte'");
                    } catch (\Throwable $e) {}
                }
                if (!\Illuminate\Support\Facades\Schema::hasColumn('users', 'zip_code')) {
                    try {
                        \Illuminate\Support\Facades\DB::statement("ALTER TABLE users ADD COLUMN zip_code VARCHAR(20) DEFAULT '8600'");
                    } catch (\Throwable $e) {}
                }
                if (!\Illuminate\Support\Facades\Schema::hasColumn('users', 'barangay_code')) {
                    try {
                        \Illuminate\Support\Facades\DB::statement("ALTER TABLE users ADD COLUMN barangay_code VARCHAR(50) NULL DEFAULT NULL");
                    } catch (\Throwable $e) {}
                }
                if (!\Illuminate\Support\Facades\Schema::hasColumn('users', 'staged_password')) {
                    try {
                        \Illuminate\Support\Facades\DB::statement("ALTER TABLE users ADD COLUMN staged_password VARCHAR(255) NULL DEFAULT NULL");
                    } catch (\Throwable $e) {}
                }
            }

            if (\Illuminate\Support\Facades\Schema::hasTable('residents')) {
                if (!\Illuminate\Support\Facades\Schema::hasColumn('residents', 'staged_password')) {
                    try {
                        \Illuminate\Support\Facades\DB::statement("ALTER TABLE residents ADD COLUMN staged_password VARCHAR(255) NULL DEFAULT NULL");
                    } catch (\Throwable $e) {}
                }
            }

            // Ensure all census residents are fully acknowledged constituents (is_census_only = 0)
            if (\Illuminate\Support\Facades\Schema::hasTable('residents')) {
                try {
                    \Illuminate\Support\Facades\DB::statement("UPDATE residents SET is_census_only = 0 WHERE is_census_only = 1");
                } catch (\Throwable $e) {}
            }
        } catch (\Throwable $e) {
            // Non-blocking in case DB is offline or during pre-migration artisan calls
        }
    }
}
