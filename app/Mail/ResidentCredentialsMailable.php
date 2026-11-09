<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class ResidentCredentialsMailable extends Mailable
{
    use Queueable, SerializesModels;

    public string $name;
    public string $emailAddress;
    public string $password;
    public string $barangay;
    public string $portalUrl;

    /**
     * Create a new message instance.
     */
    public function __construct(string $name, string $emailAddress, string $password, string $barangay = 'Barangay Pianing', ?string $portalUrl = null)
    {
        $this->name = $name;
        $this->emailAddress = $emailAddress;
        $this->password = $password;
        $this->barangay = $barangay;
        $this->portalUrl = $portalUrl ?: env('APP_URL', 'https://sdsb-production.up.railway.app');
    }

    /**
     * Get the message envelope.
     */
    public function envelope(): Envelope
    {
        return new Envelope(
            subject: "[{$this->barangay}] Official Login Credentials & Online Access",
        );
    }

    /**
     * Build the message or return raw text / html.
     */
    public function build()
    {
        return $this->subject("[{$this->barangay}] Official Login Credentials & Online Access")
                    ->html("
            <div style='font-family: Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; color: #1e293b;'>
                <div style='text-align: center; margin-bottom: 24px;'>
                    <h2 style='color: #006B66; margin: 0;'>{$this->barangay} Governance Portal</h2>
                    <p style='color: #64748b; font-size: 13px; margin-top: 4px;'>Official Citizen Account Credentials</p>
                </div>
                
                <p style='font-size: 14px;'>Dear <strong>{$this->name}</strong>,</p>
                <p style='font-size: 14px; line-height: 1.5;'>
                    Your account has been officially provisioned in the {$this->barangay} Digital Registry. 
                    You can now access online civil clearance requests, BHW clinic appointments, and civic governance tools.
                </p>
                
                <div style='background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 18px; margin: 20px 0;'>
                    <div style='margin-bottom: 10px;'>
                        <span style='font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: bold;'>Login Email (Username):</span><br/>
                        <strong style='font-size: 15px; color: #0f172a;'>{$this->emailAddress}</strong>
                    </div>
                    <div>
                        <span style='font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: bold;'>Default Password:</span><br/>
                        <code style='font-size: 16px; font-weight: bold; background: #e0f2fe; color: #0369a1; padding: 4px 8px; border-radius: 4px;'>{$this->password}</code>
                    </div>
                </div>

                <p style='font-size: 13px; color: #b45309;'>
                    <strong>Security Notice:</strong> For your security, please sign in and change your default password immediately in your Profile Settings.
                </p>

                <div style='text-align: center; margin: 28px 0;'>
                    <a href='{$this->portalUrl}/login' style='background-color: #006B66; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px; display: inline-block;'>Sign In to Citizen Portal</a>
                </div>

                <hr style='border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;' />
                <p style='font-size: 11px; color: #94a3b8; text-align: center;'>
                    This is an automated municipal civil registration notice. If you did not request this, please contact your Barangay Hall.
                </p>
            </div>
                    ");
    }
}

