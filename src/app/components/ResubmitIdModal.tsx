import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Upload, Camera, AlertTriangle, CheckCircle2, User, Phone, MapPin, X, Eye } from 'lucide-react';
import { apiService } from '../../services/api';
import { saveStoredUser } from '../../utils/safeStorage';
import { toast } from 'sonner';

interface ResubmitIdModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
  onResubmitted: (updatedUser: any) => void;
}

export default function ResubmitIdModal({
  isOpen,
  onClose,
  user,
  onResubmitted
}: ResubmitIdModalProps) {
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [idImage, setIdImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user && isOpen) {
      const uFirst = user.first_name || (user.name ? user.name.split(' ')[0] : '') || '';
      const uLast = user.last_name || (user.name ? user.name.split(' ').slice(1).join(' ') : '') || '';
      const uMiddle = user.middle_name || '';
      setFirstName(uFirst);
      setMiddleName(uMiddle);
      setLastName(uLast);
      setPhone(user.phone || '');
      setAddress(user.address || '');
      setIdImage(user.submitted_id || null);
    }
  }, [user, isOpen]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size exceeds limit', { description: 'Please select an image smaller than 5MB.' });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setIdImage(reader.result as string);
      toast.success('ID photo loaded!');
    };
    reader.readAsDataURL(file);
  };

  const handleResubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!idImage) {
      toast.error('Government ID required', { description: 'Please attach a clear photo of your valid Government ID.' });
      return;
    }
    if (!firstName.trim() || !lastName.trim()) {
      toast.error('Name required', { description: 'Please provide both First Name and Last Name.' });
      return;
    }

    const cleanFirst = firstName.trim();
    const cleanMiddle = middleName.trim();
    const cleanLast = lastName.trim();
    const computedName = `${cleanFirst} ${cleanMiddle ? cleanMiddle + ' ' : ''}${cleanLast}`.trim();

    setLoading(true);
    try {
      const res = await apiService.resubmitVerification({
        id: user?.id,
        email: user?.email,
        submitted_id: idImage,
        first_name: cleanFirst,
        middle_name: cleanMiddle,
        last_name: cleanLast,
        address: address.trim(),
        phone: phone.trim()
      });

      if (res?.success) {
        const updatedUser = {
          ...user,
          name: computedName,
          first_name: cleanFirst,
          middle_name: cleanMiddle,
          last_name: cleanLast,
          phone: phone.trim(),
          address: address.trim(),
          submitted_id: idImage,
          verification_status: 'Pending_Review',
          rejection_reason: null
        };

        saveStoredUser(updatedUser);
        onResubmitted(updatedUser);
        toast.success('Verification Resubmitted!', {
          description: 'Your updated ID is now in the Barangay Admin approval queue.'
        });
        onClose();
      } else {
        toast.error(res?.message || 'Failed to resubmit. Please try again.');
      }
    } catch (err: any) {
      toast.error('Network error during resubmission', { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-white dark:bg-slate-900 max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-900 dark:text-white text-base font-bold">
            <Upload className="text-indigo-600" size={20} />
            Resubmit Government ID &amp; Verification
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Please review the reason below, attach a clear photo of your valid ID, and submit for Barangay Admin review.
          </DialogDescription>
        </DialogHeader>

        {/* Notice of Correction from Admin */}
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 rounded-xl p-3.5 space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900 dark:text-amber-300">
            <AlertTriangle size={15} className="text-amber-600" />
            Notice from Barangay Administrator:
          </div>
          <p className="text-xs text-amber-800 dark:text-amber-200 pl-5 font-medium leading-relaxed">
            {user?.rejection_reason || 'Your submitted Government ID or address details require revision. Please upload a clear, uncropped photo of your valid ID.'}
          </p>
        </div>

        <form onSubmit={handleResubmit} className="space-y-4 py-1">
          {/* Photo Uploader */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
              <span>Photo of Valid Government ID <span className="text-red-500">*</span></span>
              <span className="text-[10px] text-slate-400 font-normal">Accepted: Cedula, PhilID, Drivers License, Passport, Voters ID</span>
            </Label>

            {idImage ? (
              <div className="relative border-2 border-indigo-200 dark:border-indigo-800 rounded-xl overflow-hidden bg-slate-950/5 group">
                <img src={idImage} alt="ID Document Preview" className="w-full h-48 object-contain bg-slate-900/5" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    className="h-8 text-xs bg-white text-slate-900 font-semibold gap-1.5 cursor-pointer shadow"
                  >
                    <Camera size={13} /> Change Photo
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    onClick={() => setIdImage(null)}
                    className="h-8 text-xs font-semibold gap-1 cursor-pointer shadow"
                  >
                    <X size={13} /> Remove
                  </Button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-400 bg-slate-50 dark:bg-slate-800/50 rounded-xl p-6 text-center cursor-pointer transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 flex items-center justify-center mx-auto mb-2">
                  <Camera size={20} />
                </div>
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Click to upload or take a photo of your ID</p>
                <p className="text-[10px] text-slate-400 mt-0.5">PNG, JPG, or JPEG up to 5MB</p>
              </div>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          </div>

          {/* Verification Details: Names */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">First Name <span className="text-red-500">*</span></Label>
              <Input
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                required
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Middle Name</Label>
              <Input
                value={middleName}
                onChange={e => setMiddleName(e.target.value)}
                placeholder="Optional"
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Last Name <span className="text-red-500">*</span></Label>
              <Input
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                required
                className="h-9 text-xs"
              />
            </div>
          </div>

          {/* Contact and Address */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Mobile Phone Number</Label>
              <Input
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="09171234567"
                maxLength={13}
                className="h-9 text-xs font-mono"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Registered Home Address</Label>
              <Input
                value={address}
                onChange={e => setAddress(e.target.value)}
                placeholder="e.g. Purok 1, Barangay Anticala"
                className="h-9 text-xs"
              />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="text-xs h-9"
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !idImage}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold h-9 px-5 gap-1.5 cursor-pointer"
            >
              {loading ? (
                <span>Submitting...</span>
              ) : (
                <>
                  <CheckCircle2 size={15} /> Resubmit for Approval
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
