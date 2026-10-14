<?php

namespace App\Http\Controllers;

use App\Models\ActivityLog;
use App\Models\DocumentCategory;
use App\Models\DocumentRequest;
use App\Models\Resident;
use App\Models\User;
use App\Models\UserNotification;
use App\Services\EmailService;
use App\Services\PdfService;
use App\Services\SmsService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DocumentController extends Controller
{
    public function index(Request $request)
    {
        $barangay = $request->input('barangay');
        $email = $request->input('email');
        $residentId = $request->input('resident_id');

        $query = DB::table('document_requests as d')
            ->leftJoin('residents as r', function ($join) {
                $join->on('d.resident_id', '=', 'r.id')
                     ->orWhere(function ($q) {
                         $q->where(function ($sub) {
                             $sub->whereNull('d.resident_id')->orWhere('d.resident_id', 0);
                         })
                         ->where(function ($sub) {
                             $sub->whereRaw('d.email != "" AND LOWER(d.email) = LOWER(r.email)')
                                 ->orWhereRaw('LOWER(d.resident_name) = LOWER(CONCAT(r.first_name, " ", r.last_name))');
                         });
                     });
            })
            ->select(
                'd.*',
                DB::raw("COALESCE(NULLIF(d.resident_id, 0), r.id) as resident_id"),
                'r.id as matched_resident_id',
                'r.first_name as resident_first_name',
                'r.middle_name as resident_middle_name',
                'r.last_name as resident_last_name',
                'r.purok as resident_purok',
                'r.household_number as resident_household_number',
                'r.family_name as resident_family_name',
                'r.is_head_of_household as resident_is_head_of_household',
                'r.relationship_to_head as resident_relationship_to_head',
                'r.employment_status as resident_employment_status',
                'r.years_of_residency as resident_years_of_residency',
                'r.phone as resident_phone',
                'r.email as resident_email',
                'r.submitted_id as resident_submitted_id',
                'r.id_type as resident_id_type',
                'r.verification_status as resident_verification_status',
                DB::raw("COALESCE(r.address, '') as resident_address"),
                DB::raw("COALESCE(r.civil_status, 'Single') as resident_civil_status"),
                DB::raw("COALESCE(r.gender, '') as resident_gender"),
                'r.date_of_birth as resident_birth_date',
                DB::raw("TIMESTAMPDIFF(YEAR, r.date_of_birth, CURDATE()) as resident_age")
            );

        if (!empty($email) || !empty($residentId)) {
            $query->where(function ($q) use ($email, $residentId) {
                if (!empty($email)) {
                    $q->whereRaw('LOWER(d.email) = ?', [strtolower($email)])
                      ->orWhereRaw('LOWER(r.email) = ?', [strtolower($email)]);
                }
                if (!empty($residentId)) {
                    $q->orWhere('d.resident_id', $residentId)
                      ->orWhere('r.id', $residentId);
                }
            });
        }

        if (!empty($barangay) && !str_contains(strtolower($barangay), 'all')) {
            $norm = AuthController::normalizeBarangayName($barangay);
            $query->whereRaw('LOWER(d.barangay) = ?', [strtolower($norm)]);
        }

        $docs = $query->orderBy('d.requested_at', 'desc')->get();
        return response()->json($docs);
    }

    public function store(Request $request)
    {
        $residentName = trim((string)$request->input('resident_name', 'Resident'));
        $docType = trim((string)$request->input('document_type', 'Barangay Clearance'));
        $purpose = trim((string)$request->input('purpose', 'General Clearance'));
        $barangay = AuthController::normalizeBarangayName($request->input('barangay'));
        $email = strtolower(trim((string)$request->input('resident_email', $request->input('email', ''))));
        $residentId = $request->input('resident_id');

        if (empty($residentId) || $residentId == 1) {
            $matchedResident = null;
            if (!empty($email)) {
                $matchedResident = Resident::whereRaw('LOWER(email) = ?', [$email])->first();
            }
            if (!$matchedResident && !empty($residentName) && strtolower($residentName) !== 'resident') {
                $matchedResident = Resident::whereRaw('LOWER(CONCAT(first_name, " ", last_name)) = ?', [strtolower($residentName)])->first();
            }
            if ($matchedResident) {
                $residentId = $matchedResident->id;
            }
        }

        $requestCode = 'DOC-' . rand(10000000, 99999999);

        // Process Purok Certificate Photo
        $purokCertPhoto = $request->input('purok_certificate_photo');
        $photoPath = null;
        if (!empty($purokCertPhoto)) {
            $photoPath = AuthController::saveBase64Image($purokCertPhoto, 'purok_cert');
        }

        // Process Extra Fields
        $extraFields = $request->input('extra_fields');
        if (is_array($extraFields)) {
            if ($photoPath) {
                $extraFields['purok_certificate_photo'] = $photoPath;
            }
            $extraFields = json_encode($extraFields);
        } elseif (is_string($extraFields)) {
            $decoded = json_decode($extraFields, true);
            if (is_array($decoded)) {
                if ($photoPath) {
                    $decoded['purok_certificate_photo'] = $photoPath;
                }
                $extraFields = json_encode($decoded);
            }
        } elseif ($photoPath) {
            $extraFields = json_encode(['purok_certificate_photo' => $photoPath]);
        }

        $doc = DocumentRequest::create([
            'request_code' => $requestCode,
            'resident_id' => $residentId ?: 1,
            'resident_name' => $residentName,
            'email' => $email,
            'document_type' => $docType,
            'purpose' => $purpose,
            'barangay' => $barangay,
            'status' => 'Pending',
            'requested_at' => now(),
            'remarks' => $request->input('remarks'),
            'extra_fields' => $extraFields,
            'purok_certificate_photo' => $photoPath,
        ]);

        ActivityLog::create([
            'user_name' => $residentName,
            'user_role' => 'resident',
            'action' => "Submitted document request: {$docType} ({$requestCode})",
        ]);

        if (!empty($email)) {
            EmailService::sendDocumentStatusEmail($email, $residentName, $docType, $requestCode, 'Pending', null, $barangay);
        }

        return response()->json($doc, 201);
    }

    public function update(Request $request, $id)
    {
        $doc = DocumentRequest::find($id);
        if (!$doc) {
            return response()->json(['error' => 'Document request not found'], 404);
        }

        $oldStatus = $doc->status;
        $newStatus = $request->input('status', $doc->status);

        $doc->update([
            'status' => $newStatus,
            'processed_at' => in_array($newStatus, ['Processing', 'Ready for Pickup', 'Completed', 'Rejected']) ? now() : $doc->processed_at,
            'processed_by' => $request->input('processed_by', 'Barangay Staff'),
            'remarks' => $request->input('remarks', $doc->remarks),
        ]);

        ActivityLog::create([
            'user_name' => $request->input('processed_by', 'Staff'),
            'user_role' => 'staff',
            'action' => "Updated document request {$doc->request_code} to {$newStatus}",
        ]);

        // Send notifications across In-App, Email, and SMS on status change
        if ($oldStatus !== $newStatus) {
            $resident = Resident::find($doc->resident_id);
            if (!$resident && !empty($doc->email)) {
                $resident = Resident::whereRaw('LOWER(email) = ?', [strtolower($doc->email)])->first();
            }
            $user = !empty($doc->email) ? User::whereRaw('LOWER(email) = ?', [strtolower($doc->email)])->first() : null;
            $phone = $resident?->phone ?: ($user?->phone ?: '');

            if (!empty($doc->email)) {
                EmailService::sendDocumentStatusEmail(
                    $doc->email,
                    $doc->resident_name,
                    $doc->document_type,
                    $doc->request_code,
                    $newStatus,
                    $doc->remarks,
                    $doc->barangay
                );

                try {
                    $notifTitle = $newStatus === 'Completed'
                        ? "✅ Document Claimed: {$doc->document_type}"
                        : ($newStatus === 'Ready for Pickup' ? "🎉 Ready for Pick-Up: {$doc->document_type}" : "📄 Status: {$doc->document_type}");
                    $notifMsg = $newStatus === 'Completed'
                        ? "Your {$doc->document_type} ({$doc->request_code}) has been officially claimed and marked as COMPLETED. Thank you!"
                        : ($newStatus === 'Ready for Pickup'
                            ? "Your requested {$doc->document_type} ({$doc->request_code}) is now PRINTED, SIGNED, and READY FOR PICKUP at Barangay {$doc->barangay} Hall. Please bring a valid ID."
                            : "Your requested {$doc->document_type} ({$doc->request_code}) is now in status: {$newStatus}." . ($doc->remarks ? " Remarks: {$doc->remarks}" : ""));

                    UserNotification::create([
                        'recipient_email' => $doc->email,
                        'type' => 'Document',
                        'title' => $notifTitle,
                        'message' => $notifMsg,
                        'ref_code' => $doc->request_code,
                        'is_read' => 0,
                        'created_at' => now(),
                    ]);
                } catch (\Throwable $ne) {}
            }

            // Live SMS via iProg SMS Gateway for Completed and Ready for Pickup
            if (!empty($phone)) {
                if ($newStatus === 'Completed') {
                    SmsService::sendLiveSms(
                        $phone,
                        "Barangay {$doc->barangay}: Hello {$doc->resident_name}! Your {$doc->document_type} ({$doc->request_code}) has been marked as COMPLETED. Thank you for using our digital portal!"
                    );
                } elseif ($newStatus === 'Ready for Pickup') {
                    SmsService::sendLiveSms(
                        $phone,
                        "Magandang araw {$doc->resident_name}! Your {$doc->document_type} ({$doc->request_code}) is now READY FOR PICKUP at Barangay {$doc->barangay} Hall. Please bring a valid ID."
                    );
                }
            }
        }

        return response()->json(['success' => true, 'document' => $doc]);
    }

    public function destroy($id)
    {
        $doc = DocumentRequest::find($id);
        if (!$doc) {
            return response()->json(['error' => 'Document request not found'], 404);
        }

        $doc->delete();
        return response()->json(['success' => true, 'message' => 'Document request deleted']);
    }

    public function downloadPdf($id)
    {
        $doc = DB::table('document_requests as d')
            ->leftJoin('residents as r', function ($join) {
                $join->on('d.resident_id', '=', 'r.id')
                     ->orWhere(function ($q) {
                         $q->whereNull('d.resident_id')
                           ->orWhere('d.resident_id', 0)
                           ->whereRaw('d.email != "" AND LOWER(d.email) = LOWER(r.email)');
                     });
            })
            ->select(
                'd.*',
                DB::raw("COALESCE(r.address, '') as resident_address"),
                DB::raw("COALESCE(r.civil_status, 'Single') as resident_civil_status"),
                DB::raw("COALESCE(r.gender, '') as resident_gender"),
                'r.date_of_birth as resident_birth_date'
            )
            ->where('d.id', $id)
            ->first();

        if (!$doc) {
            return response()->json(['error' => 'Document request not found'], 404);
        }

        try {
            $pdfBytes = PdfService::generateDocumentPdf($doc);
            $safeType = preg_replace('/[^a-zA-Z0-9_-]/', '_', $doc->document_type ?: 'Document');
            $safeCode = preg_replace('/[^a-zA-Z0-9_-]/', '_', (string)($doc->request_code ?: $id));
            $filename = "{$safeType}_{$safeCode}.pdf";

            return response($pdfBytes, 200, [
                'Content-Type' => 'application/pdf',
                'Content-Disposition' => "attachment; filename=\"{$filename}\"",
                'Content-Length' => strlen($pdfBytes),
            ]);
        } catch (\Throwable $e) {
            return response()->json(['error' => 'Failed to generate PDF file', 'details' => $e->getMessage()], 500);
        }
    }

    public function generatePdfDirect(Request $request)
    {
        $doc = $request->all();
        if (empty($doc['document_type'])) {
            return response()->json(['error' => 'Document data with document_type required'], 400);
        }

        try {
            $pdfBytes = PdfService::generateDocumentPdf($doc);
            $safeType = preg_replace('/[^a-zA-Z0-9_-]/', '_', $doc['document_type']);
            $filename = "{$safeType}_Preview.pdf";

            return response($pdfBytes, 200, [
                'Content-Type' => 'application/pdf',
                'Content-Disposition' => "attachment; filename=\"{$filename}\"",
                'Content-Length' => strlen($pdfBytes),
            ]);
        } catch (\Throwable $e) {
            return response()->json(['error' => 'Failed to generate PDF file', 'details' => $e->getMessage()], 500);
        }
    }

    public function getCategories()
    {
        $categories = DocumentCategory::orderBy('name')->get();
        return response()->json($categories);
    }

    public function createCategory(Request $request)
    {
        $name = trim((string)$request->input('name', ''));
        if (empty($name)) {
            return response()->json(['error' => 'Category name is required'], 400);
        }

        $cat = DocumentCategory::create([
            'name' => $name,
            'department' => $request->input('department', 'Barangay'),
            'description' => $request->input('description', ''),
            'status' => $request->input('status', 'Active'),
        ]);

        return response()->json(['success' => true, 'category' => $cat], 201);
    }

    public function updateCategory(Request $request, $name)
    {
        $cat = DocumentCategory::where('name', $name)->first();
        if (!$cat) {
            return response()->json(['error' => 'Category not found'], 404);
        }

        $cat->update($request->only(['description', 'department', 'status']));
        return response()->json(['success' => true, 'category' => $cat]);
    }

    public function deleteCategory($name)
    {
        $cat = DocumentCategory::where('name', $name)->first();
        if (!$cat) {
            return response()->json(['error' => 'Category not found'], 404);
        }

        $cat->delete();
        return response()->json(['success' => true, 'message' => 'Category deleted']);
    }
}
