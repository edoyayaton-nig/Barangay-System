<?php

namespace App\Http\Controllers;

use App\Services\EmailService;
use Illuminate\Http\Request;

class EmailController extends Controller
{
    public function test(Request $request)
    {
        $to = $request->input('to', 'admin@barangay.gov');
        $res = EmailService::sendEmail([
            'to' => $to,
            'subject' => 'Test Notification from Barangay Pianing',
            'text' => 'This is a test notification confirming email service functionality.',
        ]);
        return response()->json($res);
    }

    public function announcement(Request $request)
    {
        $recipients = $request->input('recipients', []);
        $title = $request->input('title', 'Community Advisory');
        $message = $request->input('message', '');
        $severity = $request->input('severity', 'Info');

        $res = EmailService::sendAnnouncementEmail($recipients, $title, $message, $severity);
        return response()->json($res);
    }

    public function send(Request $request)
    {
        $res = EmailService::sendEmail($request->all());
        return response()->json($res);
    }

    public function status()
    {
        return response()->json([
            'status' => 'Online',
            'provider' => env('MAIL_USERNAME') ? 'Gmail SMTP' : 'EmailJS / Simulation',
            'configured' => true,
        ]);
    }
}
