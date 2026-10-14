<?php

namespace App\Http\Controllers;

use App\Models\ActivityLog;
use App\Models\Inventory;
use Illuminate\Http\Request;

class InventoryController extends Controller
{
    public function index(Request $request)
    {
        $query = Inventory::query();
        $barangay = $request->input('barangay');
        if (!empty($barangay) && !str_contains(strtolower($barangay), 'all')) {
            $norm = AuthController::normalizeBarangayName($barangay);
            $query->whereRaw('LOWER(barangay) = ?', [strtolower($norm)]);
        }
        return response()->json($query->orderBy('item_name')->get());
    }

    public function store(Request $request)
    {
        $barangay = AuthController::normalizeBarangayName($request->input('barangay'));
        $stock = (int)$request->input('stock', 0);
        $status = $stock === 0 ? 'Out of Stock' : ($stock < 10 ? 'Low Stock' : 'In Stock');

        $item = Inventory::create([
            'barangay' => $barangay,
            'item_name' => (string)$request->input('item_name', 'Essential Medicine'),
            'category' => (string)$request->input('category', 'Essential Medicine'),
            'stock' => $stock,
            'unit' => (string)$request->input('unit', 'units'),
            'expiry_date' => $request->input('expiry_date'),
            'status' => $status,
        ]);

        ActivityLog::create([
            'user_name' => 'Health Worker',
            'user_role' => 'bhw',
            'action' => "Added medicine/vaccine stock: {$item->item_name} ({$stock} {$item->unit})",
        ]);

        return response()->json(['success' => true, 'item' => $item], 201);
    }

    public function update(Request $request, $id)
    {
        $item = Inventory::find($id);
        if (!$item) return response()->json(['error' => 'Item not found'], 404);

        $stock = $request->has('stock') ? (int)$request->input('stock') : $item->stock;
        $status = $stock <= 0 ? 'Out of Stock' : ($stock < 10 ? 'Low Stock' : 'In Stock');

        $data = $request->all();
        $data['stock'] = max(0, $stock);
        $data['status'] = $status;

        $item->update($data);
        return response()->json(['success' => true, 'item' => $item]);
    }

    public function destroy($id)
    {
        $item = Inventory::find($id);
        if (!$item) return response()->json(['error' => 'Item not found'], 404);
        $item->delete();
        return response()->json(['success' => true, 'message' => 'Inventory item deleted']);
    }

    public function dispense(Request $request)
    {
        $itemId = $request->input('item_id', $request->input('id'));
        $itemName = $request->input('item_name');
        $barangay = $request->input('barangay');
        $qty = (int)$request->input('quantity', 1);
        $patient = $request->input('patient_name', 'Patient');
        $worker = $request->input('attending_worker', 'Health Center Staff');

        $item = null;
        if (!empty($itemId)) {
            $item = Inventory::find($itemId);
        } elseif (!empty($itemName)) {
            $q = Inventory::where('item_name', $itemName);
            if (!empty($barangay) && !str_contains(strtolower($barangay), 'all')) {
                $q->whereRaw('LOWER(barangay) = ?', [strtolower(AuthController::normalizeBarangayName($barangay))]);
            }
            $item = $q->first();
        }

        if (!$item) return response()->json(['error' => 'Inventory item not found'], 404);

        $newStock = max(0, $item->stock - $qty);
        $status = $newStock === 0 ? 'Out of Stock' : ($newStock < 10 ? 'Low Stock' : 'In Stock');

        $item->update([
            'stock' => $newStock,
            'status' => $status,
        ]);

        ActivityLog::create([
            'user_name' => $worker,
            'user_role' => 'bhw',
            'action' => "Dispensed {$qty} {$item->unit} of {$item->item_name} to {$patient}",
        ]);

        return response()->json([
            'success' => true,
            'item' => $item,
            'message' => "Successfully dispensed {$qty} {$item->unit} of {$item->item_name}.",
        ]);
    }
}
