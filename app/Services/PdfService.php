<?php

namespace App\Services;

use Dompdf\Dompdf;
use Dompdf\Options;

class PdfService
{
    /**
     * Generate official Barangay Document PDF matching the exact templates
     * from cert_01.jpg – cert_18.jpg with dual logos.
     */
    public static function generateDocumentPdf(array|object $doc): string
    {
        $d = (array) $doc;

        $docType       = $d['document_type'] ?? 'Barangay Clearance';
        $residentName  = $d['resident_name'] ?? 'CITIZEN';
        $nameCaps      = strtoupper($residentName);
        $address       = $d['resident_address'] ?? ($d['address'] ?? '');
        $purpose       = self::cleanPurpose($d['purpose'] ?? 'General Requirements');
        $civilStatus   = strtolower(trim($d['resident_civil_status'] ?? ($d['civil_status'] ?? 'single')));
        $gender        = strtolower(trim($d['resident_gender'] ?? ($d['gender'] ?? 'male')));
        $barangay      = $d['barangay'] ?? 'Pianing';
        $refCode       = $d['request_code'] ?? ('DOC-' . ($d['id'] ?? time()));

        // Extra / dynamic fields
        $extra = [];
        if (!empty($d['extra_fields'])) {
            $extra = is_string($d['extra_fields'])
                ? (json_decode($d['extra_fields'], true) ?: [])
                : (array) $d['extra_fields'];
        }

        // Date helpers
        $now      = new \DateTime();
        $day      = $now->format('j');
        $ordDay   = self::ordinal($day);
        $month    = $now->format('F');
        $year     = $now->format('Y');
        $dateStr  = $now->format('F j, Y');

        // Pronouns
        $isFemale = in_array($gender, ['female', 'f']);
        $heShe    = $isFemale ? 'she' : 'he';
        $HeShe    = $isFemale ? 'She' : 'He';
        $hisHer   = $isFemale ? 'her' : 'his';
        $himHer   = $isFemale ? 'her' : 'him';
        $honorific = $isFemale ? ($civilStatus === 'married' ? 'Mrs.' : 'Ms.') : 'Mr.';

        // Purok extraction
        $purok = self::extractPurok($address, $extra);

        // Age
        $age = self::extractAge($d, $extra);

        // ── Base64 encode logos ──────────────────────────────────────────────
        $hasGd = extension_loaded('gd');
        $butuanLogoPath  = public_path('assets/butuan-logo.png');
        $pianingLogoPath = public_path('assets/pianing-logo.png');

        $butuanB64 = ($hasGd && file_exists($butuanLogoPath))
            ? 'data:image/png;base64,' . base64_encode(file_get_contents($butuanLogoPath))
            : '';
        $pianingB64 = ($hasGd && file_exists($pianingLogoPath))
            ? 'data:image/png;base64,' . base64_encode(file_get_contents($pianingLogoPath))
            : '';

        // ── Build body HTML per document type ────────────────────────────────
        $upperType = strtoupper($docType);
        $body = '';

        if (str_contains($upperType, 'CLEARANCE') && !str_contains($upperType, 'BUSINESS') && !str_contains($upperType, 'GOOD MORAL')) {
            // ── BARANGAY CLEARANCE (cert_16, cert_17) ──────────────────────
            $body = self::buildClearance($nameCaps, $residentName, $civilStatus, $purok, $purpose, $heShe, $HeShe, $hisHer, $ordDay, $month, $year);
        } elseif (str_contains($upperType, 'GOOD MORAL')) {
            // ── GOOD MORAL CLEARANCE (cert_12, cert_18) ────────────────────
            $body = self::buildGoodMoral($nameCaps, $honorific, $civilStatus, $purok, $address, $purpose, $heShe, $hisHer, $ordDay, $month, $year);
        } elseif (str_contains($upperType, 'RESIDENCY')) {
            // ── CERTIFICATE OF RESIDENCY (cert_15) ─────────────────────────
            $body = self::buildResidency($nameCaps, $residentName, $purok, $hisHer, $extra, $ordDay, $month, $year);
        } elseif (str_contains($upperType, 'INDIGENCY')) {
            // ── CERTIFICATE OF INDIGENCY (cert_13, cert_14) ────────────────
            $body = self::buildIndigency($nameCaps, $residentName, $age, $gender, $purok, $purpose, $hisHer, $ordDay, $month, $year);
        } elseif (str_contains($upperType, 'BUSINESS') && str_contains($upperType, 'PERMIT')) {
            // ── BUSINESS PERMIT (cert_01) ──────────────────────────────────
            $body = self::buildBusinessPermit($nameCaps, $residentName, $civilStatus, $purok, $address, $purpose, $extra, $ordDay, $month, $year);
        } elseif (str_contains($upperType, 'BUSINESS')) {
            // ── BUSINESS CLEARANCE (cert_08, cert_11) ──────────────────────
            $body = self::buildBusinessClearance($nameCaps, $residentName, $purok, $purpose, $extra, $ordDay, $month, $year);
        } elseif (str_contains($upperType, 'EMPLOYMENT')) {
            // ── CERTIFICATE OF EMPLOYMENT (cert_07) ────────────────────────
            $body = self::buildEmployment($nameCaps, $residentName, $civilStatus, $purok, $hisHer, $extra, $ordDay, $month, $year);
        } elseif (str_contains($upperType, 'LAND') || str_contains($upperType, 'OCCUPANCY')) {
            // ── CERTIFICATE OF LAND OCCUPANCY (cert_03–cert_06) ────────────
            $body = self::buildLandOccupancy($nameCaps, $residentName, $civilStatus, $purok, $extra, $ordDay, $month, $year);
        } elseif (str_contains($upperType, 'BARANGAY ID') || $upperType === 'BARANGAY ID') {
            // ── BARANGAY ID ────────────────────────────────────────────────
            $body = self::buildBarangayId($d, $butuanB64, $pianingB64, $purok, $dateStr);
        } else {
            // ── DEFAULT / GENERIC CERTIFICATION ────────────────────────────
            $body = self::buildGeneric($nameCaps, $residentName, $civilStatus, $purok, $purpose, $hisHer, $ordDay, $month, $year);
        }

        // ── Determine office heading ─────────────────────────────────────────
        $officeName = 'OFFICE OF THE PUNONG BARANGAY';
        if (str_contains($upperType, 'BUSINESS')) {
            $officeName = 'OFFICE OF THE SANGGUNIANG BARANGAY';
        }

        // ── Determine title ──────────────────────────────────────────────────
        $title = self::getDocTitle($docType);

        // ── Determine signature block ────────────────────────────────────────
        $sigBlock = self::getSignatureBlock($docType, $ordDay, $month, $year);

        // ── Assemble full HTML ───────────────────────────────────────────────
        $isBarangayId = (str_contains($upperType, 'BARANGAY ID'));

        if ($isBarangayId) {
            // Barangay ID has a completely custom layout – body contains everything
            $html = self::wrapHtml($body, true);
        } else {
            $innerHtml = self::buildPageContent($butuanB64, $pianingB64, $officeName, $title, $body, $sigBlock);
            $html = self::wrapHtml($innerHtml);
        }

        // ── Render with DomPDF ───────────────────────────────────────────────
        $options = new Options();
        $options->set('isHtml5ParserEnabled', true);
        $options->set('isRemoteEnabled', true);
        $options->set('defaultFont', 'Arial');

        $dompdf = new Dompdf($options);
        $dompdf->loadHtml($html);
        $dompdf->setPaper('letter', 'portrait');
        $dompdf->render();

        return $dompdf->output();
    }

    // ╔══════════════════════════════════════════════════════════════════════════╗
    // ║                        TEMPLATE BUILDER METHODS                         ║
    // ╚══════════════════════════════════════════════════════════════════════════╝

    /**
     * BARANGAY CLEARANCE — cert_16.jpg, cert_17.jpg
     */
    private static function buildClearance(
        string $nameCaps, string $name, string $civilStatus, string $purok,
        string $purpose, string $heShe, string $HeShe, string $hisHer,
        string $ordDay, string $month, string $year
    ): string {
        return "
            <p class='salute'>TO WHOM IT MAY CONCERN:</p>
            <p class='para'>This is to certify that <strong>{$name}</strong> of legal age,
                {$civilStatus} is a bona fide resident of Purok {$purok}, Pianing, Butuan City.</p>
            <p class='para'><strong>{$HeShe}</strong> is known to be a person of <strong>GOOD MORAL CHARACTER</strong>
                and is a law-abiding citizen. Our records show that {$heShe} is not currently been charged
                of any crime against {$hisHer} person, no pending case &nbsp; nor a member of any
                subversive organization in our community.</p>
            <p class='para'>This clearance is being issued upon the request of {$name}
                for {$hisHer} <strong>{$purpose}</strong> and for whatever legal purposes it may serve
                best. This document is valid for six (6) months from the date of issuance.</p>
            <p class='para'>This is being issued on the <strong>{$ordDay}</strong> day of
                <strong>{$month}</strong>&nbsp;&nbsp;<strong>{$year}</strong> at the Office of the
                Punong Barangay of Pianing, Butuan City, Agusan Del Norte, Philippines.</p>
        ";
    }

    /**
     * GOOD MORAL CLEARANCE — cert_12.jpg, cert_18.jpg
     */
    private static function buildGoodMoral(
        string $nameCaps, string $honorific, string $civilStatus, string $purok,
        string $address, string $purpose, string $heShe, string $hisHer,
        string $ordDay, string $month, string $year
    ): string {
        $fullAddr = $address ?: "Purok {$purok}, Barangay Pianing, Butuan City";
        return "
            <p class='salute'>TO WHOM IT MAY CONCERN:</p>
            <p class='para'>This is to certify that <strong style='text-decoration:underline;'>{$honorific} {$nameCaps}</strong>,
                of legal age and a bonafide resident of {$fullAddr}.</p>
            <p class='para'>This further certifies that <strong>{$honorific} {$nameCaps}</strong> as per records on file
                of this office, <strong>{$heShe}</strong> has not been involved in any unlawful act or activities
                within the barangay and <strong>NOT in the BADAC list</strong>.</p>
            <p class='para'>This certification is being issued upon the request of the above-named person
                as a requirement for {$hisHer} <strong>{$purpose}</strong>.</p>
            <p class='para'>Issued this <strong>{$ordDay}</strong> day of <strong>{$month}</strong>,
                <strong>{$year}</strong> at the Office of the Punong Barangay of Pianing, Butuan City, Philippines.</p>
        ";
    }

    /**
     * CERTIFICATE OF RESIDENCY — cert_15.jpg
     */
    private static function buildResidency(
        string $nameCaps, string $name, string $purok, string $hisHer,
        array $extra, string $ordDay, string $month, string $year
    ): string {
        $duration = self::cleanResidencyYears($extra);
        return "
            <p class='salute'>TO WHOM IT MAY CONCERN:</p>
            <p class='para'>This is to certify that <strong>{$name}</strong>, Filipino, is a bonafide
                <strong>resident</strong> of Purok {$purok}, Barangay Pianing, Butuan City together with
                {$hisHer} entire family circle.</p>
            <p class='para'>This certifies further that the above-mentioned resident has been permanently
                living and residing at Purok {$purok}, Barangay Pianing, Butuan City <strong>{$duration}</strong>.</p>
            <p class='para'>This certification is being issued upon the request of the concerned party
                for whatever legal purposes it may serve best.</p>
            <p class='para'>This document is given this <strong>{$ordDay}</strong> day of
                <strong>{$month}</strong>&nbsp;&nbsp;<strong>{$year}</strong> at the Office of the Punong
                Barangay of Pianing, Butuan City, Philippines.</p>
        ";
    }

    /**
     * CERTIFICATE OF INDIGENCY — cert_13.jpg, cert_14.jpg
     */
    private static function buildIndigency(
        string $nameCaps, string $name, string $age, string $gender, string $purok,
        string $purpose, string $hisHer, string $ordDay, string $month, string $year
    ): string {
        return "
            <p class='salute'>TO WHOM IT MAY CONCERN:</p>
            <p class='para'>This is to certify that <strong>{$name}</strong>, <strong>{$age}</strong>,
                <strong>{$gender}</strong> and a resident of P {$purok}, Barangay Pianing, Butuan City.</p>
            <p class='para'>This certifies further that the above-mentioned-name and {$hisHer} family is one
                of our identified <strong>INDIGENT</strong> constituents in the community and in need of
                <strong>{$purpose}</strong> assistance.</p>
            <p class='para'>This certification is being issued upon the request of the above mentioned-name
                for whatever legal purposes it may serve best.</p>
            <p class='para'>Issued this <strong>{$ordDay}</strong> day of
                <strong>{$month}</strong>&nbsp;&nbsp;<strong>{$year}</strong> at Barangay Pianing,
                Butuan City, Philippines.</p>
        ";
    }

    /**
     * BUSINESS PERMIT — cert_01.jpg
     */
    private static function buildBusinessPermit(
        string $nameCaps, string $name, string $civilStatus, string $purok,
        string $address, string $purpose, array $extra,
        string $ordDay, string $month, string $year
    ): string {
        $bizName = strtoupper($extra['Business Name'] ?? ($extra['business_name'] ?? 'COMMERCIAL ESTABLISHMENT'));
        $representative = $extra['Representative'] ?? ($extra['representative'] ?? $name);
        $repAddress = $extra['Representative Address'] ?? ($extra['rep_address'] ?? $address ?: "Pianing, Butuan City");
        $activityDates = $extra['Activity Dates'] ?? ($extra['activity_dates'] ?? '');
        $activityDesc = $extra['Activity Description'] ?? ($extra['activity_description'] ?? 'conduct a demonstration on their products within the vicinity of the Barangay');

        return "
            <p class='salute'>TO WHOM IT MAY CONCERN:</p>
            <p class='para'>This is to certify that <strong style='text-decoration:underline;'>{$bizName}</strong> through its representative
                <strong>{$representative}</strong> of legal age, {$civilStatus}, a resident of {$repAddress}
                (as document presented), came to this office to obtain a permit to {$activityDesc}" .
                ($activityDates ? " on {$activityDates}" : '') . ".</p>
            <p class='para'>This certification is issued upon the request of the party for whatever legal purposes it may serve best.</p>
            <p class='para'>Issued this <strong>{$ordDay}</strong> day of <strong><u>{$month} {$year}</u></strong>
                at Barangay Pianing, Butuan City, Philippines.</p>
        ";
    }

    /**
     * BUSINESS CLEARANCE — cert_08.jpg, cert_11.jpg
     */
    private static function buildBusinessClearance(
        string $nameCaps, string $name, string $purok, string $purpose,
        array $extra, string $ordDay, string $month, string $year
    ): string {
        $bizName = $extra['Business Name'] ?? ($extra['business_name'] ?? ($extra['Nature of Business'] ?? 'General Merchandise / Sari-Sari Store'));
        $formattedPurok = (stripos($purok, 'Purok') !== false) ? $purok : "Purok {$purok}";

        return "
            <p class='salute'>TO WHOM IT MAY CONCERN:</p>
            <p class='para'>This is to certify that <strong>{$name}</strong>, of legal age, bona-fide resident of
                {$formattedPurok}, Barangay Pianing, Butuan City, Philippines, has a <strong>{$bizName}</strong>
                store business located in its/own residence Based on the verification gathered.</p>
            <p class='para'>This certification is issued upon the request of the above-named person for
                <strong>{$purpose}</strong> and for whatever legal purpose it may serve.</p>
            <p class='para'>Issued this <strong>{$ordDay}</strong> day of
                <strong>{$month}</strong>&nbsp;&nbsp;<strong>{$year}</strong> at Barangay
                <strong>Pianing</strong>, Butuan City, Philippines.</p>
        ";
    }

    /**
     * CERTIFICATE OF EMPLOYMENT — cert_07.jpg
     */
    private static function buildEmployment(
        string $nameCaps, string $name, string $civilStatus, string $purok,
        string $hisHer, array $extra, string $ordDay, string $month, string $year
    ): string {
        $position  = $extra['Job Position'] ?? ($extra['Position'] ?? ($extra['Role'] ?? 'Barangay Worker'));
        $employer  = $extra['Employer'] ?? ($extra['Company'] ?? ($extra['Office'] ?? 'Barangay Pianing'));
        $startDate = $extra['Start Date'] ?? '';
        $endDate   = $extra['End Date'] ?? 'Present';
        if (!$startDate) {
            $period = $extra['Employment Period'] ?? ($extra['Period'] ?? 'January 2024 to Present');
            if (str_contains($period, ' to ')) {
                [$startDate, $endDate] = explode(' to ', $period, 2);
            } else {
                $startDate = $period;
                $endDate = 'Present';
            }
        }

        return "
            <p class='salute'>TO WHOM IT MAY CONCERN:</p>
            <p class='para'>This is to certify that <strong>{$name}</strong>, of legal age, {$civilStatus} is a
                <strong>bona fide resident</strong> of Purok {$purok}, Barangay Pianing, Butuan City together with
                {$hisHer} entire family.</p>
            <p class='para'>This certifies further that the above-mentioned person has worked as
                <strong>{$position}</strong> of <strong>{$employer}</strong> from
                <strong>{$startDate}</strong> to <strong>{$endDate}</strong>.</p>
            <p class='para'>This certification is being issued upon the request of the party for whatever legal
                purposes it may serve best.</p>
            <p class='para'>Issued this <strong>{$ordDay}</strong> day of
                <strong>{$month}</strong>&nbsp;&nbsp;<strong>{$year}</strong> at the Office of the Punong
                Barangay of Pianing, this City, Philippines.</p>
        ";
    }

    /**
     * CERTIFICATE OF LAND OCCUPANCY / ACTUAL OCCUPANCY — cert_03 to cert_06.jpg
     */
    private static function buildLandOccupancy(
        string $nameCaps, string $name, string $civilStatus, string $purok,
        array $extra, string $ordDay, string $month, string $year
    ): string {
        $landArea   = $extra['Land Area'] ?? ($extra['Area'] ?? 'Nine Hundred Thirty-One (931)');
        $landArea   = preg_replace('/\s*(?:square\s*meters?\s*(?:more\s*or\s*less)?|sqm|sq\.?\s*m\.?).*$/i', '', $landArea);
        if (!trim($landArea)) $landArea = 'Nine Hundred Thirty-One (931)';

        $lotNumber  = $extra['Lot Number'] ?? ($extra['Lot #'] ?? ($extra['Lot No.'] ?? '1005'));
        $surveyInfo = $extra['Survey Info'] ?? ($extra['Cadastral'] ?? ($extra['Survey / PLS'] ?? 'PLS-74'));
        $yearStarted = $extra['Occupancy Since'] ?? ($extra['Occupancy Period'] ?? ($extra['Since Year'] ?? "1970's"));
        $yearStarted = preg_replace('/^(?:since\s*(?:the\s*year\s*)?|the\s*year\s*)/i', '', $yearStarted);
        if (!trim($yearStarted)) $yearStarted = "1970's";

        $formattedPurok = (stripos($purok, 'Purok') !== false) ? $purok : "Purok {$purok}";

        return "
            <p class='salute'>TO WHOM IT MAY CONCERN:</p>
            <p class='para'>This is to certify that <strong style='text-decoration:underline;'>{$nameCaps}</strong>, Filipino,
                {$civilStatus}, a bona fide resident of {$formattedPurok} Pianing, Butuan City is the
                <strong style='text-decoration:underline;'>ACTUAL OCCUPANT</strong> on a parcel of land with an area of
                <strong style='text-decoration:underline;'>{$landArea}</strong> square meters more or less, identified as
                Lot # {$lotNumber}, {$surveyInfo} <span style='text-decoration:underline;'>since</span> the year
                {$yearStarted} until this document has been made.</p>
            <p class='para'>This certification is being issued upon the requesting party for whatever legal
                purposes it may serve best.</p>
            <p class='para'>Given this <strong>{$ordDay}</strong> day of
                <strong>{$month}</strong>&nbsp;&nbsp;<strong>{$year}</strong> at the Office of the Punong Barangay
                of Pianing, Butuan City, Philippines.</p>
        ";
    }

    /**
     * BARANGAY ID — custom card layout
     */
    private static function buildBarangayId(
        array $d, string $butuanB64, string $pianingB64,
        string $purok, string $dateStr
    ): string {
        $name        = strtoupper($d['resident_name'] ?? 'CITIZEN');
        $address     = $d['resident_address'] ?? ($d['address'] ?? "Purok {$purok}, Barangay Pianing, Butuan City");
        $dob         = $d['resident_birth_date'] ?? ($d['date_of_birth'] ?? '');
        $civilStatus = ucfirst($d['resident_civil_status'] ?? ($d['civil_status'] ?? 'Single'));
        $gender      = ucfirst($d['resident_gender'] ?? ($d['gender'] ?? 'Male'));
        $idNum       = $d['request_code'] ?? ('BID-' . ($d['id'] ?? time()));

        if ($dob) {
            try { $dob = (new \DateTime($dob))->format('F j, Y'); } catch (\Exception $e) { /* keep raw */ }
        }

        $extra = [];
        if (!empty($d['extra_fields'])) {
            $extra = is_string($d['extra_fields'])
                ? (json_decode($d['extra_fields'], true) ?: [])
                : (array) $d['extra_fields'];
        }
        $emergencyContact = $extra['Emergency Contact'] ?? ($extra['emergency_contact'] ?? '');
        $emergencyPhone   = $extra['Emergency Phone'] ?? ($extra['emergency_phone'] ?? '');

        return "
            <div style='width:100%; max-width:3.375in; margin:0.5in auto; border:2px solid #1e3a8a; border-radius:12px; overflow:hidden; font-family:Arial,sans-serif; font-size:8pt; page-break-inside:avoid;'>
                <!-- FRONT -->
                <div style='background:linear-gradient(135deg,#1e3a8a,#2563eb); color:#fff; padding:8px 12px; text-align:center;'>
                    <table width='100%'><tr>
                        <td width='40' style='vertical-align:middle;'>" . ($butuanB64 ? "<img src='{$butuanB64}' width='35' height='35' />" : '') . "</td>
                        <td style='text-align:center; vertical-align:middle;'>
                            <div style='font-size:6pt;'>Republic of the Philippines</div>
                            <div style='font-size:7pt; font-weight:bold;'>BARANGAY PIANING</div>
                            <div style='font-size:6pt;'>Butuan City</div>
                        </td>
                        <td width='40' style='vertical-align:middle; text-align:right;'>" . ($pianingB64 ? "<img src='{$pianingB64}' width='35' height='35' />" : '') . "</td>
                    </tr></table>
                    <div style='font-size:10pt; font-weight:bold; margin-top:4px; letter-spacing:1px;'>BARANGAY ID</div>
                </div>
                <div style='padding:10px 14px; background:#fff; color:#000;'>
                    <table width='100%'><tr>
                        <td style='vertical-align:top; width:65%;'>
                            <div style='font-size:7pt; color:#64748b; margin-bottom:2px;'>ID Number</div>
                            <div style='font-size:9pt; font-weight:bold; margin-bottom:6px;'>{$idNum}</div>
                            <div style='font-size:7pt; color:#64748b; margin-bottom:2px;'>Full Name</div>
                            <div style='font-size:10pt; font-weight:bold; margin-bottom:6px;'>{$name}</div>
                            <div style='font-size:7pt; color:#64748b; margin-bottom:2px;'>Address</div>
                            <div style='font-size:8pt; margin-bottom:6px;'>{$address}</div>
                        </td>
                        <td style='vertical-align:top; text-align:center; width:35%;'>
                            <div style='width:1in; height:1in; border:1px solid #cbd5e1; background:#f1f5f9; margin:0 auto 4px auto; display:flex; align-items:center; justify-content:center;'>
                                <span style='font-size:7pt; color:#94a3b8;'>PHOTO</span>
                            </div>
                        </td>
                    </tr></table>
                    <table width='100%' style='font-size:8pt; margin-top:4px;'><tr>
                        <td><strong>Date of Birth:</strong> {$dob}</td>
                        <td><strong>Gender:</strong> {$gender}</td>
                    </tr><tr>
                        <td><strong>Civil Status:</strong> {$civilStatus}</td>
                        <td>&nbsp;</td>
                    </tr></table>
                    " . ($emergencyContact ? "<div style='margin-top:6px; font-size:7pt; border-top:1px solid #e2e8f0; padding-top:4px;'>
                        <strong>Emergency Contact:</strong> {$emergencyContact}" . ($emergencyPhone ? " — {$emergencyPhone}" : '') . "
                    </div>" : '') . "
                    <table width='100%' style='margin-top:12px;'><tr>
                        <td style='width:50%; text-align:center; font-size:7pt;'>
                            <div style='border-top:1px solid #000; width:90%; margin:0 auto;'></div>
                            Holder's Signature
                        </td>
                        <td style='width:50%; text-align:center; font-size:7pt;'>
                            <div style='border-top:1px solid #000; width:90%; margin:0 auto;'></div>
                            <strong>VIRGENIA S. GOLANDRINA</strong><br/>Punong Barangay
                        </td>
                    </tr></table>
                    <div style='text-align:center; font-size:6pt; color:#94a3b8; margin-top:6px;'>Date Issued: {$dateStr}</div>
                </div>
            </div>
        ";
    }

    /**
     * GENERIC / DEFAULT CERTIFICATION
     */
    private static function buildGeneric(
        string $nameCaps, string $name, string $civilStatus, string $purok,
        string $purpose, string $hisHer, string $ordDay, string $month, string $year
    ): string {
        return "
            <p class='salute'>TO WHOM IT MAY CONCERN:</p>
            <p class='para'>This is to certify that <strong>{$name}</strong>, of legal age,
                {$civilStatus}, Filipino citizen, and a bonafide resident of Purok {$purok},
                Pianing, Butuan City, Agusan Del Norte. This certification is issued for the purpose
                of <strong>{$purpose}</strong> and for whatever legal purposes it may serve.</p>
            <p class='para'>This document is issued on the <strong>{$ordDay}</strong> day of
                <strong>{$month}</strong>, <strong>{$year}</strong> at the Office of the Punong Barangay
                of Pianing, Butuan City, Agusan Del Norte, Philippines.</p>
        ";
    }

    // ╔══════════════════════════════════════════════════════════════════════════╗
    // ║                         PAGE ASSEMBLY HELPERS                           ║
    // ╚══════════════════════════════════════════════════════════════════════════╝

    private static function buildPageContent(
        string $butuanB64, string $pianingB64, string $officeName,
        string $title, string $body, string $sigBlock
    ): string {
        $leftLogo  = $butuanB64 ? "<img src='{$butuanB64}' class='hdr-logo' />" : '';
        $rightLogo = $pianingB64 ? "<img src='{$pianingB64}' class='hdr-logo' />" : '';

        return "
            <div class='doc-wrapper'>
                <!-- HEADER -->
                <table class='hdr' width='100%'>
                    <tr>
                        <td class='hdr-logo-cell' width='110'>{$leftLogo}</td>
                        <td class='hdr-center'>
                            <div class='rep'>Republic of the Philippines</div>
                            <div class='bold'>{$officeName}</div>
                            <div class='loc'>Pianing, Butuan City</div>
                        </td>
                        <td class='hdr-logo-cell' width='110' style='text-align:right;'>{$rightLogo}</td>
                    </tr>
                </table>

                <!-- TITLE -->
                <div class='doc-title'>{$title}</div>

                <!-- BODY -->
                {$body}

                <!-- SIGNATURES -->
                {$sigBlock}
            </div>
        ";
    }

    private static function getDocTitle(string $docType): string
    {
        $upper = strtoupper($docType);
        if (str_contains($upper, 'CLEARANCE') && !str_contains($upper, 'BUSINESS') && !str_contains($upper, 'GOOD MORAL')) {
            return 'BARANGAY CLEARANCE';
        }
        if (str_contains($upper, 'GOOD MORAL')) {
            return 'Good Moral Clearance';
        }
        if (str_contains($upper, 'RESIDENCY')) {
            return 'CERTIFICATION OF RESIDENCY';
        }
        if (str_contains($upper, 'INDIGENCY')) {
            return 'CERTIFICATE OF INDIGENCY';
        }
        if (str_contains($upper, 'BUSINESS') && str_contains($upper, 'PERMIT')) {
            return 'PERMIT';
        }
        if (str_contains($upper, 'BUSINESS')) {
            return 'BARANGAY BUSINESS CLEARANCE';
        }
        if (str_contains($upper, 'EMPLOYMENT')) {
            return 'CERTIFICATION';
        }
        if (str_contains($upper, 'LAND') || str_contains($upper, 'OCCUPANCY')) {
            return 'CERTIFICATE OF LAND OCCUPANCY';
        }
        return strtoupper($docType);
    }

    private static function getSignatureBlock(string $docType, string $ordDay, string $month, string $year): string
    {
        $upper = strtoupper($docType);

        // Barangay Clearance: Affiant + Attested + Approved + Purok Chairman + Date/OR
        if (str_contains($upper, 'CLEARANCE') && !str_contains($upper, 'BUSINESS') && !str_contains($upper, 'GOOD MORAL')) {
            return "
                <!-- Affiant -->
                <div class='affiant-wrap'>
                    <div class='affiant-line'>&nbsp;</div><br/>
                    <div class='affiant-label'>Affiant's Signature</div>
                </div>

                <!-- Attested / Approved -->
                <table class='sig-row' width='100%'>
                    <tr>
                        <td width='50%'>
                            <div class='sig-label'>ATTESTED BY:</div>
                            <div class='sig-name'>TERESITA ROJO-ENTERO</div>
                            <div class='sig-title'>Barangay Secretary</div>
                        </td>
                        <td width='50%' style='text-align:left;'>
                            <div class='sig-label'>APPROVED BY:</div>
                            <div class='sig-name'>VIRGENIA S. GOLANDRINA</div>
                            <div class='sig-title'>Punong Barangay</div>
                        </td>
                    </tr>
                </table>

                <!-- Purok Chairman + Date/OR -->
                <table width='100%' style='margin-top:30px; font-size:10pt;'>
                    <tr>
                        <td width='50%'>
                            <div>MR./MRS.<span style='border-bottom:1px solid #000; display:inline-block; width:120px;'>&nbsp;</span></div>
                            <div style='margin-left:20px;'>Purok Chairman</div>
                        </td>
                        <td width='50%'>&nbsp;</td>
                    </tr>
                    <tr>
                        <td colspan='2' style='padding-top:20px;'>
                            <div>Date issued: <span style='border-bottom:1px solid #000; display:inline-block; width:100px;'>&nbsp;</span></div>
                            <div style='margin-top:4px;'>O.R #:<span style='border-bottom:1px solid #000; display:inline-block; width:130px;'>&nbsp;</span></div>
                        </td>
                    </tr>
                </table>
            ";
        }

        // Default: Certified By (Punong Barangay only)
        return "
            <table class='sig-row' width='100%'>
                <tr>
                    <td width='50%'>&nbsp;</td>
                    <td width='50%'>
                        <div class='sig-label'>CERTIFIED BY:</div>
                        <div class='sig-name'>VIRGENIA S. GOLANDRINA</div>
                        <div class='sig-title'>Punong Barangay</div>
                    </td>
                </tr>
            </table>
        ";
    }

    // ╔══════════════════════════════════════════════════════════════════════════╗
    // ║                           HTML + CSS WRAPPER                            ║
    // ╚══════════════════════════════════════════════════════════════════════════╝

    private static function wrapHtml(string $innerContent, bool $isCardLayout = false): string
    {
        $css = "
            @page {
                margin: 0.5in 0.8in;
                size: letter portrait;
            }
            * { box-sizing: border-box; }
            body {
                font-family: Arial, Helvetica, sans-serif;
                font-size: 12pt;
                color: #000;
                margin: 0;
                padding: 0;
                line-height: 1.55;
            }
            .doc-wrapper {
                width: 100%;
                font-family: Arial, Helvetica, sans-serif;
            }

            /* ── HEADER ── */
            .hdr {
                border-collapse: collapse;
                margin-bottom: 10px;
            }
            .hdr-logo-cell {
                vertical-align: middle;
            }
            .hdr-logo {
                width: 100px;
                height: 100px;
            }
            .hdr-center {
                text-align: center;
                vertical-align: middle;
                padding: 0 8px;
            }
            .hdr-center .rep {
                font-size: 11pt;
                margin-bottom: 2px;
            }
            .hdr-center .bold {
                font-size: 13pt;
                font-weight: bold;
                letter-spacing: 0.5px;
                margin-bottom: 2px;
            }
            .hdr-center .loc {
                font-size: 10.5pt;
            }

            /* ── TITLE ── */
            .doc-title {
                text-align: center;
                font-size: 22pt;
                font-weight: bold;
                margin: 20px 0 18px 0;
                letter-spacing: 0.5px;
            }

            /* ── BODY ── */
            .salute {
                font-size: 12pt;
                font-weight: bold;
                margin-bottom: 14px;
            }
            .para {
                text-align: justify;
                font-size: 12pt;
                line-height: 1.65;
                margin-bottom: 14px;
            }

            /* ── AFFIANT ── */
            .affiant-wrap {
                text-align: right;
                margin: 24px 0 14px 0;
            }
            .affiant-line {
                display: inline-block;
                border-bottom: 1px solid #000;
                width: 200px;
                margin-bottom: 3px;
            }
            .affiant-label {
                font-size: 10.5pt;
                text-align: center;
                width: 200px;
                display: inline-block;
            }

            /* ── SIGNATURES ── */
            .sig-row {
                margin-top: 50px;
            }
            .sig-label {
                font-size: 11.5pt;
                font-weight: normal;
                margin-bottom: 45px;
            }
            .sig-name {
                font-size: 12pt;
                font-weight: bold;
                text-decoration: underline;
                text-transform: uppercase;
                margin-bottom: 2px;
            }
            .sig-title {
                font-size: 10.5pt;
                font-weight: normal;
            }
        ";

        return "
        <!DOCTYPE html>
        <html lang='en'>
        <head>
            <meta charset='utf-8'>
            <style>{$css}</style>
        </head>
        <body>
            {$innerContent}
        </body>
        </html>
        ";
    }

    // ╔══════════════════════════════════════════════════════════════════════════╗
    // ║                           UTILITY HELPERS                               ║
    // ╚══════════════════════════════════════════════════════════════════════════╝

    private static function ordinal(int|string $num): string
    {
        $n = (int) $num;
        $s = ['th', 'st', 'nd', 'rd'];
        $v = $n % 100;
        return $n . ($s[($v - 20) % 10] ?? $s[$v] ?? $s[0]);
    }

    private static function cleanPurpose(string $raw): string
    {
        if (!$raw) return 'loan application';
        $p = explode(' — ', $raw)[0];
        $p = explode(' | ', $p)[0];
        $p = preg_replace('/^Purpose:\s*/i', '', $p);
        return trim($p) ?: 'loan application';
    }

    private static function extractPurok(string $address, array $extra): string
    {
        $raw = $address ?: ($extra['Purok / Location'] ?? ($extra['Home Address'] ?? ''));
        if (!$raw) return '___';

        if (preg_match('/purok\s*([0-9A-Za-z_-]+)/i', $raw, $m)) {
            return trim($m[1]);
        }

        $first = explode(',', $raw)[0];
        $first = preg_replace('/Barangay.*/i', '', $first);
        $first = preg_replace('/^purok\s*/i', '', $first);
        return trim($first) ?: '___';
    }

    private static function extractAge(array $d, array $extra): string
    {
        $raw = $extra['Age'] ?? ($d['resident_age'] ?? ($d['age'] ?? ''));
        if ($raw && is_numeric($raw)) return "{$raw} years old";
        if ($raw && str_contains($raw, 'year')) return $raw;
        if ($raw) return $raw;

        $dobStr = $d['resident_birth_date'] ?? ($d['date_of_birth'] ?? ($extra['Date of Birth'] ?? ''));
        if ($dobStr) {
            try {
                $dob  = new \DateTime($dobStr);
                $diff = (new \DateTime())->diff($dob);
                $age  = $diff->y;
                if ($age >= 0) return "{$age} years old";
            } catch (\Exception $e) {}
        }
        return 'legal age';
    }

    private static function cleanResidencyYears(array $extra): string
    {
        $raw = $extra['Duration of Residence'] ?? ($extra['Years of Residency'] ?? ($extra['Residing Since'] ?? ($extra['Duration'] ?? '')));
        if (!$raw) return 'for more than five (5) years';
        $clean = trim($raw);
        if (preg_match('/^\d+$/', $clean)) {
            $n = (int) $clean;
            return "for {$n} year" . ($n > 1 ? 's' : '');
        }
        if (preg_match('/^\d{4}$/', $clean)) {
            return "since {$clean}";
        }
        $lower = strtolower($clean);
        if (str_starts_with($lower, 'for ') || str_starts_with($lower, 'since ')) {
            return $clean;
        }
        return "for {$clean}";
    }
}
