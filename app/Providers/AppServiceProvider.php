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

            if (\Illuminate\Support\Facades\Schema::hasTable('document_requests')) {
                if (!\Illuminate\Support\Facades\Schema::hasColumn('document_requests', 'purok_certificate_photo')) {
                    \Illuminate\Support\Facades\DB::statement("ALTER TABLE document_requests ADD COLUMN purok_certificate_photo LONGTEXT NULL");
                } else {
                    try {
                        \Illuminate\Support\Facades\DB::statement("ALTER TABLE document_requests MODIFY COLUMN purok_certificate_photo LONGTEXT NULL");
                    } catch (\Throwable $e) {}
                }
                if (!\Illuminate\Support\Facades\Schema::hasColumn('document_requests', 'extra_fields')) {
                    \Illuminate\Support\Facades\DB::statement("ALTER TABLE document_requests ADD COLUMN extra_fields LONGTEXT NULL");
                } else {
                    try {
                        \Illuminate\Support\Facades\DB::statement("ALTER TABLE document_requests MODIFY COLUMN extra_fields LONGTEXT NULL");
                    } catch (\Throwable $e) {}
                }
                if (!\Illuminate\Support\Facades\Schema::hasColumn('document_requests', 'barangay')) {
                    \Illuminate\Support\Facades\DB::statement("ALTER TABLE document_requests ADD COLUMN barangay VARCHAR(100) DEFAULT 'Pianing'");
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
                        \Illuminate\Support\Facades\DB::statement("ALTER TABLE health_appointments ADD COLUMN `{$col}` {$def}");
                    }
                }
            }

            if (\Illuminate\Support\Facades\Schema::hasTable('sms_notifications')) {
                try {
                    \Illuminate\Support\Facades\DB::statement("ALTER TABLE sms_notifications MODIFY COLUMN `type` VARCHAR(100) NOT NULL");
                } catch (\Throwable $e) {}
            }
        } catch (\Throwable $e) {
            // Non-blocking in case DB is offline or during pre-migration artisan calls
        }
    }
}
