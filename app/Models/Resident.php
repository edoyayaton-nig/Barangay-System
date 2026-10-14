<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Resident extends Model
{
    protected $table = 'residents';
    protected $guarded = [];
    public $timestamps = false;

    public function user()
    {
        return $this->belongsTo(User::class, 'email', 'email');
    }

    public function documentRequests()
    {
        return $this->hasMany(DocumentRequest::class, 'resident_id');
    }

    public function maternalRecords()
    {
        return $this->hasMany(MaternalRecord::class, 'resident_id');
    }

    public function appointments()
    {
        return $this->hasMany(HealthAppointment::class, 'resident_id');
    }
}
