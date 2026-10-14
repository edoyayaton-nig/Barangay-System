<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Immunization extends Model
{
    protected $table = 'immunizations';
    protected $guarded = [];
    public $timestamps = false;
}
