import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Checkbox } from './ui/checkbox';
import {
  Send,
  Bell,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Phone,
  Calendar,
  Heart,
  Baby,
  Sparkles,
  Users
} from 'lucide-react';
import { apiService } from '../../services/api';
import { toast } from 'sonner';

export interface DuePatientItem {
  id: number | string;
  name: string;
  phone: string;
  service: string;
  detail: string;
  dueDate: string;
  isOverdue: boolean;
  category: 'maternal' | 'immunization';
}

interface BatchSmsReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  duePatients: DuePatientItem[];
  barangay?: string;
  attendingName?: string;
  initialService?: 'Child Immunization' | 'Maternal Health';
  onBatchSent?: (sentIds: Array<number | string>) => void;
}

export default function BatchSmsReminderModal({
  isOpen,
  onClose,
  duePatients,
  barangay = 'Pianing',
  attendingName = 'Health Worker',
  initialService,
  onBatchSent
}: BatchSmsReminderModalProps) {
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});
  const [customTemplate, setCustomTemplate] = useState('');
  const [isDispatching, setIsDispatching] = useState(false);
  const [dispatchProgress, setDispatchProgress] = useState(0);

  useEffect(() => {
    if (isOpen) {
      const initialMap: Record<string, boolean> = {};
      duePatients.forEach(p => {
        if (p.phone && p.phone.trim().length >= 10) {
          initialMap[String(p.id)] = true;
        }
      });
      setSelectedIds(initialMap);
      setCustomTemplate(`Barangay ${barangay} Health Center Notice: Hello {name}, your {service} ({detail}) is scheduled/due on {date}. Please visit our health center. — ${attendingName}`);
      setDispatchProgress(0);
    }
  }, [isOpen, duePatients, barangay, attendingName]);

  const selectedCount = Object.values(selectedIds).filter(Boolean).length;
  const totalEligible = duePatients.filter(p => p.phone && p.phone.trim().length >= 10).length;

  const toggleSelectAll = () => {
    if (selectedCount === totalEligible) {
      setSelectedIds({});
    } else {
      const allTrue: Record<string, boolean> = {};
      duePatients.forEach(p => {
        if (p.phone && p.phone.trim().length >= 10) {
          allTrue[String(p.id)] = true;
        }
      });
      setSelectedIds(allTrue);
    }
  };

  const toggleSingle = (id: string | number) => {
    setSelectedIds(prev => ({
      ...prev,
      [String(id)]: !prev[String(id)]
    }));
  };

  const generatePreview = (patient: DuePatientItem) => {
    return customTemplate
      .replace('{name}', patient.name)
      .replace('{service}', patient.service)
      .replace('{detail}', patient.detail)
      .replace('{date}', patient.dueDate)
      .replace('{barangay}', barangay);
  };

  const handleSendBatch = async () => {
    const targets = duePatients.filter(p => selectedIds[String(p.id)]);
    if (targets.length === 0) {
      toast.error('No patients selected to receive SMS');
      return;
    }

    setIsDispatching(true);
    let successCount = 0;
    const sentIds: Array<number | string> = [];

    for (let i = 0; i < targets.length; i++) {
      const p = targets[i];
      const msg = generatePreview(p);
      try {
        await apiService.sendNotification({
          recipient_name: p.name,
          recipient_phone: p.phone,
          type: p.isOverdue ? 'Overdue Clinical Reminder' : 'Scheduled Clinical Reminder',
          message: msg,
          status: 'Sent'
        });
        successCount++;
        sentIds.push(p.id);
      } catch (err) {
        console.warn('SMS dispatch failed for', p.name, err);
      }
      setDispatchProgress(Math.round(((i + 1) / targets.length) * 100));
    }

    setIsDispatching(false);
    toast.success(`Batch SMS Reminders Dispatched!`, {
      description: `Successfully sent ${successCount} SMS reminder(s) to scheduled/overdue patients.`
    });

    if (onBatchSent) onBatchSent(sentIds);
    onClose();
  };

  const samplePatient = duePatients.find(p => selectedIds[String(p.id)]) || duePatients[0];

  return (
    <Dialog open={isOpen} onOpenChange={open => { if (!open && !isDispatching) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white p-0 shadow-2xl rounded-2xl border border-slate-200">
        {/* Clean White Header */}
        <div className="p-5 border-b border-slate-100 bg-white">
          <div className="flex items-center justify-between">
            <span className="bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
              Safe Batch Dispatch
            </span>
            <span className="text-xs text-slate-400 font-medium">Brgy. {barangay}</span>
          </div>
          <DialogTitle className="text-lg font-bold text-slate-900 mt-1.5 flex items-center gap-2">
            <Send className="text-amber-600" size={20} />
            Review &amp; Confirm Batch SMS Reminders
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500 mt-0.5">
            Preview recipients, customize reminder message, and dispatch verified SMS reminders to mothers &amp; infant guardians.
          </DialogDescription>
        </div>

        <div className="p-6 space-y-4">
          {/* Summary Metric Pills */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
              <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">Due / Overdue Total</span>
              <span className="text-xl font-black text-amber-900 mt-0.5 block">{duePatients.length} Patients</span>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
              <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">Ready to Receive</span>
              <span className="text-xl font-black text-emerald-900 mt-0.5 block">{totalEligible} Verified Phones</span>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
              <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider block">Selected for Dispatch</span>
              <span className="text-xl font-black text-blue-900 mt-0.5 block">{selectedCount} Selected</span>
            </div>
          </div>

          {/* SMS Message Customization */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-slate-800">Customizable Reminder Template</Label>
              <span className="text-[10px] text-slate-400 font-mono">{customTemplate.length} chars</span>
            </div>
            <textarea
              value={customTemplate}
              onChange={e => setCustomTemplate(e.target.value)}
              rows={3}
              className="w-full text-xs p-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 font-sans resize-none"
              placeholder="Type message template..."
            />
            <p className="text-[11px] text-slate-400">Available tags: <code className="text-amber-700 font-bold">{'{name}'}</code>, <code className="text-amber-700 font-bold">{'{service}'}</code>, <code className="text-amber-700 font-bold">{'{detail}'}</code>, <code className="text-amber-700 font-bold">{'{date}'}</code></p>
          </div>

          {/* Live Preview Card - Soft Light Neutral */}
          {samplePatient && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-slate-600">
                <span className="flex items-center gap-1 font-semibold"><Phone size={12} className="text-teal-600" /> Live SMS Preview ({samplePatient.name}):</span>
                <span className="font-mono text-[10px] text-slate-500">To: {samplePatient.phone}</span>
              </div>
              <p className="text-xs font-mono text-slate-800 leading-relaxed bg-white p-2.5 rounded-lg border border-slate-200">
                {generatePreview(samplePatient)}
              </p>
            </div>
          )}

          {/* Patient Selection Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Users size={14} className="text-teal-600" />
                Recipients List ({duePatients.length})
              </Label>
              <button
                type="button"
                onClick={toggleSelectAll}
                className="text-xs text-amber-700 hover:text-amber-800 font-bold cursor-pointer"
              >
                {selectedCount === totalEligible ? 'Deselect All' : 'Select All Eligible'}
              </button>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden max-h-56 overflow-y-auto divide-y divide-slate-100">
              {duePatients.map(p => {
                const hasPhone = p.phone && p.phone.trim().length >= 10;
                const isChecked = !!selectedIds[String(p.id)];
                return (
                  <div
                    key={p.id}
                    onClick={() => { if (hasPhone) toggleSingle(p.id); }}
                    className={`p-2.5 flex items-center justify-between transition-colors ${
                      !hasPhone
                        ? 'bg-slate-50 opacity-60 cursor-not-allowed'
                        : isChecked
                        ? 'bg-amber-50/60 hover:bg-amber-50 cursor-pointer'
                        : 'bg-white hover:bg-slate-50 cursor-pointer'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        disabled={!hasPhone}
                        onChange={() => {}}
                        className="rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          {p.category === 'maternal' ? (
                            <Heart size={13} className="text-pink-600 flex-shrink-0" />
                          ) : (
                            <Baby size={13} className="text-blue-600 flex-shrink-0" />
                          )}
                          <span className="font-bold text-xs text-slate-900 truncate">{p.name}</span>
                          <Badge variant="outline" className={`text-[9px] py-0 px-1 border-0 ${p.detail.includes('2nd') ? 'bg-purple-100 text-purple-800 font-bold' : 'bg-slate-100 text-slate-700'}`}>
                            {p.detail}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-slate-500 truncate">
                          Phone: <span className="font-mono">{p.phone || 'No mobile phone'}</span> · Due: {p.dueDate}
                        </p>
                      </div>
                    </div>

                    <div>
                      <Badge className={`text-[10px] border-0 ${p.isOverdue ? 'bg-red-100 text-red-700 font-bold' : 'bg-amber-100 text-amber-800'}`}>
                        {p.isOverdue ? 'Overdue' : 'Due Soon'}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {isDispatching && (
            <div className="space-y-1.5 pt-2">
              <div className="flex justify-between text-xs text-slate-600 font-medium">
                <span>Dispatching SMS alerts...</span>
                <span>{dispatchProgress}%</span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-amber-600 h-full transition-all duration-300 rounded-full"
                  style={{ width: `${dispatchProgress}%` }}
                />
              </div>
            </div>
          )}

          <DialogFooter className="pt-2 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              disabled={isDispatching}
              onClick={onClose}
              className="text-xs rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={isDispatching || selectedCount === 0}
              onClick={handleSendBatch}
              className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold gap-1.5 px-6 rounded-xl shadow-md cursor-pointer transition-all hover:shadow-amber-200"
            >
              <Send size={13} />
              {isDispatching ? `Dispatching (${dispatchProgress}%)...` : `Send ${selectedCount} SMS Reminders`}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
