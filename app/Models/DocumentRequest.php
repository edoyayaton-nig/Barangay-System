<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DocumentRequest extends Model
{
    protected $table = 'document_requests';
    protected $guarded = [];
    public $timestamps = false;

    public function resident()
    {
        return $this->belongsTo(Resident::class, 'resident_id');
    }
}
