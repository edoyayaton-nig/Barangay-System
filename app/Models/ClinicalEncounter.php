<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ClinicalEncounter extends Model
{
    protected $table = 'clinical_encounters';
    protected $guarded = [];
    public $timestamps = false;
}
