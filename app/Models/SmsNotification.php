<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SmsNotification extends Model
{
    protected $table = 'sms_notifications';
    public $timestamps = false;
    protected $guarded = [];
}
