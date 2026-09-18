// API Service Layer for Smart Barangay System

export interface DbStatusResponse {
  connected: boolean;
  mode: string;
  host?: string;
  database?: string;
  port?: number;
  error?: string;
  help?: string;
}

export interface DocumentRequest {
  id: number;
  request_code: string;
  resident_id?: number;
  resident_name: string;
  document_type: string;
  purpose?: string;
  status: 'Pending' | 'Processing' | 'Ready for Pickup' | 'Completed' | 'Rejected';
  requested_at?: string;
  processed_at?: string | null;
  processed_by?: string;
  barangay?: string;
  email?: string;
  resident_email?: string;
  extra_fields?: string | Record<string, string>;
}

export interface Resident {
  id: number;
  first_name: string;
  middle_name?: string;
  last_name: string;
  date_of_birth?: string;
  age?: number | string;
  gender: 'Male' | 'Female' | 'Other';
  civil_status?: string;
  purok?: string;
  barangay?: string;
  address: string;
  phone?: string;
  email?: string;
  submitted_id?: string;
  verification_status?: string;
  rejection_reason?: string | null;
  household_number?: string;
  family_name?: string;
  is_head_of_household?: boolean | number;
  relationship_to_head?: string;
  employment_status?: 'Employed' | 'Unemployed' | 'Self-Employed' | 'Student' | 'Retired' | 'Minor';
  is_senior?: boolean;
  is_child?: boolean;
  profile_photo?: string | null;
  years_of_residency?: string;
  id_type?: string;
}

export interface HouseholdGroup {
  household_number: string;
  purok: string;
  barangay: string;
  family_name: string;
  head_name: string;
  total_members: number;
  seniors_count: number;
  seniors_male: number;
  seniors_female: number;
  children_count: number;
  employed_count: number;
  unemployed_count: number;
  members: Resident[];
}

export interface CensusAnalytics {
  success: boolean;
  barangay: string;
  purok: string;
  total_households: number;
  total_families: number;
  total_population: number;
  senior_citizens: {
    total: number;
    male: number;
    female: number;
  };
  children_count: number;
  adults_count: number;
  employment: {
    employed: number;
    unemployed: number;
    rate_percentage: number;
  };
  purok_breakdown: {
    purok: string;
    population: number;
    households: number;
    seniors: number;
    children: number;
    employed: number;
    unemployed: number;
  }[];
}

export interface UserPermissions {
  can_create_document?: boolean;    // "New Document Request" / Issue Clearance Form
  can_process_documents?: boolean;  // Document Processing Desk
  can_manage_categories?: boolean;  // Category Manager (Super Admin delegable)
  can_verify_residents?: boolean;   // Citizen Identity Verification Desk
  can_manage_residents?: boolean;   // Resident Directory & Records
  can_access_health?: boolean;      // Health Center / Clinic & Consultations
  can_view_census?: boolean;        // Census & Demographics Analytics
  can_generate_reports?: boolean;   // System Reports & Official PDF/CSV Exports
  can_view_logs?: boolean;          // Security & Activity Audit Streams
  can_manage_users?: boolean;       // Staff Account Management
  can_access_system?: boolean;      // System Diagnostics & Backup
}

export interface SystemUser {
  id: number;
  name: string;
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  email: string;
  password?: string;
  role: 'super_mega_admin' | 'superadmin' | 'admin' | 'staff' | 'bhw' | 'nurse' | 'resident';
  status: 'Active' | 'Inactive' | 'Archived';
  barangay?: string;
  phone?: string;
  address?: string;
  purok?: string;
  date_of_birth?: string;
  gender?: string;
  civil_status?: string;
  household_number?: string;
  submitted_id?: string | null;
  years_of_residency?: string;
  employee_id?: string | null;
  job_title?: string | null;
  last_login?: string;
  created_at?: string;
  verification_status?: string;
  profile_photo?: string | null;
  permissions?: UserPermissions | null;
}

/**
 * Checks whether a user has a specific permission.
 * - super_mega_admin: Unrestricted top-tier city-level authority — returns true for all permissions.
 * - superadmin (Barangay Superadmin): Unrestricted within their barangay, but blocked from system/categories.
 * - admin: Operational barangay officer — cannot manage users (staff management removed).
 * - Custom explicit permissions override role defaults.
 * - If not explicitly set, falls back to safe role-based defaults.
 */
export function hasUserPermission(currentUser: SystemUser | null, permissionKey: keyof UserPermissions): boolean {
  if (!currentUser) return false;

  // Super Mega Admin has absolute top-tier authority — no restrictions whatsoever
  if (currentUser.role === 'super_mega_admin') return true;

  // Barangay Superadmin — unrestricted WITHIN their barangay, but explicitly blocked from system-level access
  if (currentUser.role === 'superadmin') {
    // System & Backup and Category Manager are reserved for Super Mega Admin only
    if (permissionKey === 'can_access_system' || permissionKey === 'can_manage_categories') return false;
    return true; // All other permissions granted for barangay-level operations
  }

  // If custom permission is explicitly set by Superadmin or Super Mega Admin, use it
  if (currentUser.permissions && currentUser.permissions[permissionKey] !== undefined) {
    return Boolean(currentUser.permissions[permissionKey]);
  }

  // Otherwise, role-based defaults
  const role = currentUser.role;
  switch (permissionKey) {
    case 'can_create_document':
      return role === 'admin' || role === 'staff';
    case 'can_process_documents':
      return role === 'admin' || role === 'staff';
    case 'can_verify_residents':
      return role === 'admin' || role === 'staff';
    case 'can_manage_residents':
      return role === 'admin' || role === 'staff';
    case 'can_view_census':
      return role === 'admin';
    case 'can_generate_reports':
      return role === 'admin';
    case 'can_manage_users':
      // Admin CANNOT manage staff — Staff Management is removed from Admin sidebar
      return false;
    case 'can_manage_categories':
      return false; // Super Mega Admin only — not delegable to admin/staff by default
    case 'can_view_logs':
      return false; // Delegable by Superadmin
    case 'can_access_system':
      return false; // Super Mega Admin only
    case 'can_access_health':
      return role === 'bhw' || role === 'nurse' || role === 'admin';
    default:
      return false;
  }
}


export interface PendingResident {
  id: number;
  name: string;
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  email: string;
  phone?: string;
  address?: string;
  purok?: string;
  barangay?: string;
  date_of_birth?: string;
  gender?: string;
  civil_status?: string;
  years_of_residency?: string;
  submitted_id?: string | null;
  submitted_at?: string;
  verification_status: 'Pending_Review' | 'Verified' | 'Rejected';
  rejection_reason?: string;
  profile_photo?: string | null;
}

export interface ServiceCategory {
  id: number;
  name: string;
  department: 'Barangay' | 'Health Center' | string;
  description?: string;
  status: 'Active' | 'Inactive';
  updated_at?: string;
}

export interface ActivityLog {
  id: number;
  user_name: string;
  user_role: string;
  action: string;
  action_type?: string;
  barangay?: string;
  details?: string;
  timestamp: string;
}

export interface ImmunizationRecord {
  id: number;
  resident_id?: number;
  child_name: string;
  gender?: string;
  sex?: string;
  guardian_name?: string;
  parent_name?: string;
  guardian?: string;
  parent_phone?: string;
  contact_number?: string;
  phone?: string;
  age_months?: string | number;
  weight_kg?: string | number;
  height_cm?: string | number;
  vaccine_name: string;
  vaccine_type?: string;
  vaccine_given?: string;
  dose_number: number | string;
  dose?: string;
  batch_lot?: string;
  batch_number?: string;
  status: 'Completed' | 'Scheduled' | 'Overdue';
  date_administered?: string | null;
  date_given?: string;
  due_date: string;
  next_due_date?: string;
  days_overdue?: number;
  administered_by?: string;
  attending_nurse?: string;
  remarks?: string;
  barangay?: string;
  sms_sent?: boolean;
}

export interface MaternalRecord {
  id: number;
  resident_id?: number;
  mother_name: string;
  patient_name?: string;
  age: number | string;
  pregnancy_status: string;
  expected_due_date?: string | null;
  edd?: string | null;
  last_visit: string;
  lmp?: string;
  next_visit: string;
  next_visit_date?: string;
  risk_level?: 'Low' | 'Moderate' | 'High';
  notes?: string;
  contact_number?: string;
  mother_phone?: string;
  barangay?: string;
  gravida?: string | number;
  para?: string | number;
  aog_weeks?: string | number;
  bp?: string;
  blood_pressure?: string;
  weight?: string;
  temp?: string;
  fetal_heart_rate?: string;
  fundic_height?: string;
  prescribed_meds?: string;
  attending_nurse?: string;
  sms_sent?: boolean;
  visit_number?: number;
}

export interface ClinicalConsultationRecord {
  id: number;
  patient_name: string;
  contact_number?: string;
  phone?: string;
  age?: string | number;
  gender?: string;
  civil_status?: string;
  barangay?: string;
  purok?: string;
  program_type?: string;
  service_type?: string;
  bp?: string;
  temp?: string;
  weight?: string;
  height?: string;
  heart_rate?: string;
  chief_complaint?: string;
  diagnosis?: string;
  treatment?: string;
  prescribed_meds?: string;
  attending_nurse?: string;
  attending_worker?: string;
  consultation_date?: string;
  encounter_date?: string;
  next_visit_date?: string;
  status?: string;
}

export interface InventoryItem {
  id: number;
  barangay?: string;
  item_name: string;
  category: string;
  stock: number;
  unit: string;
  expiry_date?: string;
  status: 'In Stock' | 'Low Stock' | 'Out of Stock' | string;
  updated_at?: string;
}

export interface SmsNotification {
  id: number;
  recipient_name: string;
  recipient_phone: string;
  type: string;
  message: string;
  status: 'Sent' | 'Failed' | 'Pending';
  sent_at?: string;
  is_read?: boolean | number;
}

export interface HealthAppointment {
  id: number;
  appointment_code: string;
  resident_id?: number;
  resident_name: string;
  resident_phone?: string;
  resident_email?: string;
  barangay?: string;
  service_type: string;
  preferred_date: string;
  preferred_time?: string;
  scheduled_date?: string | null;
  scheduled_time?: string | null;
  status: 'Pending' | 'Approved' | 'Completed' | 'Cancelled' | 'Rescheduled';
  bhw_notes?: string;
  resident_notes?: string;
  attending_bhw?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ClinicSchedule {
  id: number;
  title: string;
  service_type: string;
  day_of_week: string;
  time_slot: string;
  location: string;
  slots_available: number;
  bhw_in_charge: string;
  status: 'Active' | 'Suspended';
  barangay?: string;
  created_by?: string;
  created_at?: string;
  max_slots?: number;
  room?: string;
  assigned_staff?: string;
  description?: string;
}

const API_BASE = '/api';

export const apiService = {
  // DB Health Check
  async getDbStatus(): Promise<DbStatusResponse> {
    try {
      const res = await fetch(`${API_BASE}/db-status`);
      if (!res.ok) throw new Error('Status check failed');
      return await res.json();
    } catch (err) {
      return {
        connected: false,
        mode: 'In-Memory Fallback',
        error: 'API Proxy server offline'
      };
    }
  },

  // Auth
  async login(email: string, password?: string) {
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) {
        // Return error data but don't throw — caller checks data.success
        return { success: false, message: data.message || `Server error: ${res.status}` };
      }
      return data;
    } catch (err) {
      return { success: false, message: 'Cannot connect to server. Please check your connection.' };
    }
  },

  // Stats
  async getAdminStats(barangay?: string) {
    const url = barangay ? `${API_BASE}/stats/admin?barangay=${encodeURIComponent(barangay)}` : `${API_BASE}/stats/admin`;
    const res = await fetch(url);
    return await res.json();
  },

  async getBhwStats(barangay?: string) {
    const url = barangay ? `${API_BASE}/stats/bhw?barangay=${encodeURIComponent(barangay)}` : `${API_BASE}/stats/bhw`;
    const res = await fetch(url);
    return await res.json();
  },

  // Documents
  async getDocuments(params?: string | { barangay?: string; email?: string; resident_id?: number }): Promise<DocumentRequest[]> {
    let url = `${API_BASE}/documents`;
    if (typeof params === 'string') {
      if (params) url += `?barangay=${encodeURIComponent(params)}`;
    } else if (params) {
      const q = new URLSearchParams();
      if (params.barangay) q.append('barangay', params.barangay);
      if (params.email) q.append('email', params.email);
      if (params.resident_id) q.append('resident_id', String(params.resident_id));
      const qs = q.toString();
      if (qs) url += `?${qs}`;
    }
    const res = await fetch(url);
    return await res.json();
  },

  async createDocument(data: Partial<DocumentRequest>): Promise<DocumentRequest> {
    const res = await fetch(`${API_BASE}/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return await res.json();
  },

  async updateDocumentStatus(id: number, status: string, processed_by?: string) {
    const res = await fetch(`${API_BASE}/documents/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, processed_by })
    });
    return await res.json();
  },

  async deleteDocument(id: number) {
    const res = await fetch(`${API_BASE}/documents/${id}`, { method: 'DELETE' });
    return await res.json();
  },

  // Residents & Population Census
  async getResidents(barangay?: string, purok?: string): Promise<Resident[]> {
    const q = new URLSearchParams();
    if (barangay) q.append('barangay', barangay);
    if (purok && purok !== 'all') q.append('purok', purok);
    const qs = q.toString();
    const url = qs ? `${API_BASE}/residents?${qs}` : `${API_BASE}/residents`;
    const res = await fetch(url);
    return await res.json();
  },

  async getCensusStats(barangay?: string, purok?: string): Promise<CensusAnalytics> {
    const q = new URLSearchParams();
    if (barangay) q.append('barangay', barangay);
    if (purok && purok !== 'all') q.append('purok', purok);
    const qs = q.toString();
    const url = qs ? `${API_BASE}/census/stats?${qs}` : `${API_BASE}/census/stats`;
    const res = await fetch(url);
    return await res.json();
  },

  async getHouseholds(barangay?: string, purok?: string): Promise<HouseholdGroup[]> {
    const q = new URLSearchParams();
    if (barangay) q.append('barangay', barangay);
    if (purok && purok !== 'all') q.append('purok', purok);
    const qs = q.toString();
    const url = qs ? `${API_BASE}/census/households?${qs}` : `${API_BASE}/census/households`;
    const res = await fetch(url);
    return await res.json();
  },

  async createResident(data: Partial<Resident>): Promise<Resident> {
    const res = await fetch(`${API_BASE}/residents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return await res.json();
  },

  async updateResident(id: number, data: Partial<Resident>): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/residents/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return await res.json();
  },

  // System Users
  async getUsers(): Promise<SystemUser[]> {
    const res = await fetch(`${API_BASE}/users`);
    return await res.json();
  },

  async createUser(data: Partial<SystemUser>): Promise<SystemUser> {
    const res = await fetch(`${API_BASE}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return await res.json();
  },

  async updateUser(id: number, data: Partial<SystemUser & { password?: string }>): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/users/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return await res.json();
  },

  async resetUserPassword(id: number, newPassword?: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/users/${id}/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newPassword })
    });
    return await res.json();
  },

  async deleteUser(id: number) {
    const res = await fetch(`${API_BASE}/users/${id}`, { method: 'DELETE' });
    return await res.json();
  },

  // Immunizations
  async getImmunizations(): Promise<ImmunizationRecord[]> {
    const res = await fetch(`${API_BASE}/immunizations`);
    return await res.json();
  },

  async createImmunization(data: Partial<ImmunizationRecord>): Promise<ImmunizationRecord> {
    const res = await fetch(`${API_BASE}/immunizations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return await res.json();
  },

  async updateImmunization(id: number, status: string, administered_by?: string) {
    const res = await fetch(`${API_BASE}/immunizations/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, administered_by })
    });
    return await res.json();
  },

  // Maternal
  async getMaternalRecords(): Promise<MaternalRecord[]> {
    const res = await fetch(`${API_BASE}/maternal`);
    return await res.json();
  },

  async createMaternalRecord(data: Partial<MaternalRecord>): Promise<MaternalRecord> {
    const res = await fetch(`${API_BASE}/maternal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return await res.json();
  },

  // Consultations
  async getConsultations(barangay?: string): Promise<ClinicalConsultationRecord[]> {
    const query = barangay ? `?barangay=${encodeURIComponent(barangay)}` : '';
    const res = await fetch(`${API_BASE}/consultations${query}`);
    return await res.json();
  },

  async createConsultation(data: Partial<ClinicalConsultationRecord>): Promise<ClinicalConsultationRecord> {
    const res = await fetch(`${API_BASE}/consultations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return await res.json();
  },

  // Inventory Management
  async getInventory(barangay?: string): Promise<InventoryItem[]> {
    const query = barangay ? `?barangay=${encodeURIComponent(barangay)}` : '';
    const res = await fetch(`${API_BASE}/inventory${query}`);
    return await res.json();
  },

  async addInventoryItem(data: Partial<InventoryItem>): Promise<InventoryItem> {
    const res = await fetch(`${API_BASE}/inventory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return await res.json();
  },

  async updateInventoryItem(id: number | string, data: Partial<InventoryItem>): Promise<InventoryItem> {
    const res = await fetch(`${API_BASE}/inventory/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return await res.json();
  },

  async deleteInventoryItem(id: number | string): Promise<{ success: boolean; message?: string }> {
    const res = await fetch(`${API_BASE}/inventory/${id}`, {
      method: 'DELETE'
    });
    return await res.json();
  },

  async dispenseInventoryItem(item_name: string, quantity = 1, barangay?: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/inventory/dispense`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item_name, quantity, barangay })
    });
    return await res.json();
  },

  // SMS Notifications
  async getNotifications(params?: { department?: string; role?: string }): Promise<SmsNotification[]> {
    const q = new URLSearchParams();
    if (params?.department) q.append('department', params.department);
    if (params?.role) q.append('role', params.role);
    const qs = q.toString() ? `?${q.toString()}` : '';
    const res = await fetch(`${API_BASE}/notifications${qs}`);
    return await res.json();
  },

  async sendNotification(data: Partial<SmsNotification>): Promise<SmsNotification> {
    const res = await fetch(`${API_BASE}/notifications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return await res.json();
  },

  async sendSmsNotification(data: Partial<SmsNotification>): Promise<SmsNotification> {
    return this.sendNotification(data);
  },

  async markNotificationRead(id: number): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/notifications/${id}/read`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' }
    });
    return await res.json();
  },

  async markAllNotificationsRead(): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/notifications/mark-all-read`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' }
    });
    return await res.json();
  },

  // Auth Registration
  async register(data: { name?: string; first_name?: string; middle_name?: string; last_name?: string; date_of_birth?: string; gender?: string; civil_status?: string; employment_status?: string; email: string; password?: string; role?: string; address?: string; phone?: string; submitted_id?: string; id_type?: string; years_of_residency?: string; barangay?: string; city?: string; purok?: string }) {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const json = await res.json();
    if (!res.ok || json.success === false) {
      throw new Error(json.message || 'Registration failed.');
    }
    return json;
  },

  // Update Profile (password, phone, name, address, date_of_birth, profile_photo, purok, gender, civil_status)
  async updateProfile(data: { id?: number; email?: string; password?: string; phone?: string; name?: string; address?: string; date_of_birth?: string; profile_photo?: string; avatar?: string; purok?: string; gender?: string; civil_status?: string }) {
    const res = await fetch(`${API_BASE}/users/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return await res.json();
  },

  // Pending Resident Registrations (Admin)
  async getPendingResidents(barangay?: string): Promise<PendingResident[]> {
    const url = barangay ? `${API_BASE}/residents/pending?barangay=${encodeURIComponent(barangay)}` : `${API_BASE}/residents/pending`;
    const res = await fetch(url);
    return await res.json();
  },

  // Check live verification status for a resident by email
  async checkVerificationStatus(email: string) {
    try {
      const res = await fetch(`${API_BASE}/auth/check-status?email=${encodeURIComponent(email)}`);
      return await res.json();
    } catch {
      return null;
    }
  },

  async approveResident(id: number, approved_by?: string) {
    const res = await fetch(`${API_BASE}/residents/${id}/approve`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approved_by })
    });
    return await res.json();
  },

  async rejectResident(id: number, reason?: string) {
    const res = await fetch(`${API_BASE}/residents/${id}/reject`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason })
    });
    return await res.json();
  },

  async unverifyResident(id: number, status: 'Unverified' | 'Pending_Review' = 'Unverified', reason?: string) {
    const res = await fetch(`${API_BASE}/residents/${id}/unverify`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, reason })
    });
    return await res.json();
  },

  async resubmitVerification(data: { email: string; id?: number; submitted_id: string; first_name?: string; middle_name?: string; last_name?: string; address?: string; phone?: string }) {
    const res = await fetch(`${API_BASE}/residents/resubmit`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return await res.json();
  },

  async purgeResident(id: number) {
    const res = await fetch(`${API_BASE}/residents/${id}/purge`, {
      method: 'DELETE'
    });
    return await res.json();
  },

  // Intra-System Messenger
  async getMessages() {
    try {
      const res = await fetch(`${API_BASE}/messages`);
      if (!res.ok) throw new Error('Failed to fetch messages');
      return await res.json();
    } catch (err) {
      console.warn('getMessages error:', err);
      return [];
    }
  },

  async sendMessage(data: { sender_name: string; sender_role: string; recipient_name?: string; recipient_role?: string; barangay?: string; message: string }) {
    const res = await fetch(`${API_BASE}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to send message');
    return await res.json();
  },

  // Resident 360 Full Profile
  async getResidentFullProfile(id: number) {
    const res = await fetch(`${API_BASE}/residents/${id}/full-profile`);
    return await res.json();
  },

  // Service / Document Categories Management
  async getCategories(): Promise<ServiceCategory[]> {
    const res = await fetch(`${API_BASE}/categories`);
    if (!res.ok) throw new Error('Failed to fetch categories');
    return await res.json();
  },

  async updateCategory(name: string, status: 'Active' | 'Inactive'): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/categories/${encodeURIComponent(name)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    if (!res.ok) throw new Error('Failed to update category');
    return await res.json();
  },

  async createCategory(data: { name: string; department?: string; description?: string }): Promise<ServiceCategory> {
    const res = await fetch(`${API_BASE}/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.message || 'Failed to create category');
    return result;
  },

  async deleteCategory(name: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/categories/${encodeURIComponent(name)}`, {
      method: 'DELETE'
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.message || 'Failed to delete category');
    return result;
  },

  // Audit & Activity History Logs
  async getActivityLogs(params?: { barangay?: string; action_type?: string; search?: string; role?: string }): Promise<ActivityLog[]> {
    const query = new URLSearchParams();
    if (params?.barangay) query.append('barangay', params.barangay);
    if (params?.action_type) query.append('action_type', params.action_type);
    if (params?.search) query.append('search', params.search);
    if (params?.role) query.append('role', params.role);
    const queryString = query.toString() ? `?${query.toString()}` : '';
    const res = await fetch(`${API_BASE}/activity-logs${queryString}`);
    if (!res.ok) throw new Error('Failed to fetch activity logs');
    return await res.json();
  },

  async createActivityLog(data: Partial<ActivityLog>): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/activity-logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to create activity log');
    return await res.json();
  },

  // Smart AI Chatbot
  async askChatbot(question: string) {
    const res = await fetch(`${API_BASE}/chatbot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question })
    });
    return await res.json();
  },

  // ───────────────────────────────────────────────────────────────
  // Email Notification API
  // ───────────────────────────────────────────────────────────────

  async getEmailStatus(): Promise<{
    configured: boolean;
    host: string;
    port: string;
    user: string | null;
    mode: 'live' | 'simulation';
    message: string;
  }> {
    const res = await fetch(`${API_BASE}/email/status`);
    return await res.json();
  },

  async sendTestEmail(to: string): Promise<{ success: boolean; simulated?: boolean; messageId?: string; error?: string }> {
    const res = await fetch(`${API_BASE}/email/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to }),
    });
    return await res.json();
  },

  async sendAnnouncementEmail(data: {
    recipients: { email: string; name?: string }[];
    title: string;
    body: string;
    sender?: string;
  }): Promise<{ total: number; sent: number; failed: number }> {
    const res = await fetch(`${API_BASE}/email/announcement`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return await res.json();
  },

  async sendEmail(data: { to: string; subject: string; html?: string; text?: string }): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const res = await fetch(`${API_BASE}/email/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return await res.json();
  },

  // ───────────────────────────────────────────────────────────────
  // Automated Scheduling API
  // ───────────────────────────────────────────────────────────────

  async getVaccineSchedules(): Promise<{
    vaccine: string;
    totalDoses: number;
    doses: { dose: number; label: string; offsetDays: number }[];
  }[]> {
    const res = await fetch(`${API_BASE}/scheduling/vaccines`);
    return await res.json();
  },

  async computeNextDose(data: {
    vaccine_name: string;
    completed_dose: number;
    administered_date?: string;
  }): Promise<{
    hasNext: boolean;
    nextDose?: number;
    nextDueDate?: string;
    label?: string;
    displayDate?: string;
  }> {
    const res = await fetch(`${API_BASE}/scheduling/next-dose`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return await res.json();
  },

  async computeNextMaternalVisit(data: {
    pregnancy_status: string;
    last_visit?: string;
    expected_due_date?: string;
  }): Promise<{
    nextVisit: string;
    displayDate: string;
    interval: string;
    recommendation: string;
  }> {
    const res = await fetch(`${API_BASE}/scheduling/next-maternal-visit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return await res.json();
  },

  async getOverdueRecords(): Promise<{
    overdueImmunizations: any[];
    overdueMaternalVisits: any[];
  }> {
    const res = await fetch(`${API_BASE}/scheduling/overdue`);
    return await res.json();
  },

  // ───────────────────────────────────────────────────────────────
  // Health Center Appointments API
  // ───────────────────────────────────────────────────────────────

  async getAppointments(params?: {
    resident_id?: number;
    email?: string;
    status?: string;
    barangay?: string;
  }): Promise<HealthAppointment[]> {
    const query = new URLSearchParams();
    if (params?.resident_id) query.append('resident_id', String(params.resident_id));
    if (params?.email) query.append('email', params.email);
    if (params?.status) query.append('status', params.status);
    if (params?.barangay) query.append('barangay', params.barangay);

    const queryString = query.toString() ? `?${query.toString()}` : '';
    const res = await fetch(`${API_BASE}/appointments${queryString}`);
    if (!res.ok) throw new Error('Failed to fetch appointments');
    return await res.json();
  },

  async createAppointment(data: Partial<HealthAppointment>): Promise<HealthAppointment> {
    const res = await fetch(`${API_BASE}/appointments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.message || 'Failed to create appointment');
    }
    return await res.json();
  },

  async updateAppointment(id: number, data: Partial<HealthAppointment> & { user_name?: string; user_role?: string }): Promise<any> {
    const res = await fetch(`${API_BASE}/appointments/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update appointment');
    return await res.json();
  },

  async deleteAppointment(id: number): Promise<any> {
    const res = await fetch(`${API_BASE}/appointments/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete appointment');
    return await res.json();
  },

  // ───────────────────────────────────────────────────────────────
  // Health Center Clinic Schedules API (Posted by BHW / Admin)
  // ───────────────────────────────────────────────────────────────

  async getClinicSchedules(barangay?: string): Promise<ClinicSchedule[]> {
    const query = barangay && barangay.toLowerCase() !== 'all' ? `?barangay=${encodeURIComponent(barangay)}` : '';
    const res = await fetch(`${API_BASE}/clinic-schedules${query}`);
    if (!res.ok) throw new Error('Failed to fetch clinic schedules');
    return await res.json();
  },

  async createClinicSchedule(data: Partial<ClinicSchedule>): Promise<ClinicSchedule> {
    const res = await fetch(`${API_BASE}/clinic-schedules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create clinic schedule');
    return await res.json();
  },

  async updateClinicSchedule(id: number, data: Partial<ClinicSchedule>): Promise<any> {
    const res = await fetch(`${API_BASE}/clinic-schedules/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update clinic schedule');
    return await res.json();
  },

  async deleteClinicSchedule(id: number): Promise<any> {
    const res = await fetch(`${API_BASE}/clinic-schedules/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete clinic schedule');
    return await res.json();
  },

  // ───────────────────────────────────────────────────────────────
  // Population & Demographics API
  // ───────────────────────────────────────────────────────────────
  async getPopulationStats(barangay?: string): Promise<PopulationStats> {
    const q = barangay && barangay.toLowerCase() !== 'all' ? `?barangay=${encodeURIComponent(barangay)}` : '';
    const res = await fetch(`${API_BASE}/stats/population${q}`);
    if (!res.ok) throw new Error('Failed to fetch population demographics');
    return await res.json();
  },

  // ───────────────────────────────────────────────────────────────
  // Super Admin: 86-Barangay Municipal Hub API
  // ───────────────────────────────────────────────────────────────
  async getBarangaysOverview(): Promise<BarangayOverviewItem[]> {
    const res = await fetch(`${API_BASE}/system/barangays`);
    if (!res.ok) throw new Error('Failed to fetch barangays overview');
    return await res.json();
  },

  // ───────────────────────────────────────────────────────────────
  // Super Admin: System Diagnostics & Maintenance API
  // ───────────────────────────────────────────────────────────────
  async getDatabaseStats(): Promise<{ success: boolean; connected: boolean; tables: { table: string; count: number; status: string }[] }> {
    const res = await fetch(`${API_BASE}/system/database/stats`);
    if (!res.ok) throw new Error('Failed to fetch database stats');
    return await res.json();
  },

  async getGatewaysHealth(): Promise<any> {
    const res = await fetch(`${API_BASE}/system/gateways`);
    if (!res.ok) throw new Error('Failed to fetch gateway health');
    return await res.json();
  },

  async getMaintenanceMode(): Promise<{ enabled: boolean; type: 'down' | 'maintenance' | 'advisory'; title: string; message: string; estimated_uptime?: string; updated_at: string }> {
    const res = await fetch(`${API_BASE}/system/maintenance`);
    if (!res.ok) throw new Error('Failed to fetch maintenance status');
    return await res.json();
  },

  async toggleMaintenanceMode(
    param1: boolean | { enabled: boolean; type?: string; title?: string; message?: string; estimated_uptime?: string },
    message?: string
  ): Promise<any> {
    const body = typeof param1 === 'object'
      ? param1
      : { enabled: param1, message };

    const res = await fetch(`${API_BASE}/system/maintenance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error('Failed to toggle maintenance mode');
    return await res.json();
  },

  async searchPatients(query: string): Promise<{ patients: any[] }> {
    const res = await fetch(`${API_BASE}/patients/search?q=${encodeURIComponent(query)}`);
    if (!res.ok) throw new Error('Failed to search patients');
    return await res.json();
  },

  async submitClinicalIntake(payload: any): Promise<any> {
    const res = await fetch(`${API_BASE}/patients/intake`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Failed to record clinical intake');
    return await res.json();
  },

  async getClinicalArchives(barangay?: string): Promise<{ consultations: any[]; maternal: any[]; immunizations: any[]; schedules: any[]; appointments?: any[] }> {
    const q = barangay ? `?barangay=${encodeURIComponent(barangay)}` : '';
    const res = await fetch(`${API_BASE}/archives/clinical${q}`);
    if (!res.ok) throw new Error('Failed to fetch clinical records');
    return await res.json();
  },

  async cancelAppointment(id: number, reason?: string, attending_bhw?: string): Promise<HealthAppointment> {
    return this.updateAppointment(id, {
      status: 'Cancelled',
      bhw_notes: reason || 'Patient cancelled or did not show up',
      attending_bhw: attending_bhw || 'Attending Staff'
    });
  },

  async runOneDayScheduler(): Promise<any> {
    const res = await fetch(`${API_BASE}/scheduler/run-1day-reminders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error('Failed to run 1-day scheduler');
    return await res.json();
  }
};

export interface PopulationStats {
  success: boolean;
  barangay: string;
  total_population: number;
  online_registered: number;
  adoption_rate: number;
  registered_voters: number;
  senior_citizens: number;
  minors_children: number;
  gender: { male: number; female: number; other: number };
  purok_distribution: { purok: string; count: number }[];
}

export interface BarangayOverviewItem {
  id: number;
  name: string;
  status: 'Active' | 'Unstaffed';
  admin: { id: number; name: string; email: string; phone: string } | null;
  total_residents: number;
  pending_approvals: number;
  total_documents: number;
  office_address: string;
  hotline: string;
}

