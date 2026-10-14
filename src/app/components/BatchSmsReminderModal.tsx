import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from './ui/dialog';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
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
  Users,
  Loader2,
  Check
} from 'lucide-react';
import { apiService } from '../../services/api';
import { saveSentReminderIds, notifyHealthDataChanged } from '../../services/healthSync';
import { dispatchResidentNotification } from '../../services/emailJsService';
import { toast } from 'sonner';

export interface DuePatientItem {
  id: number | string;
  name: string;
  phone: string;
  email?: string;
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
  const [isCompleted, setIsCompleted] = useState(false);
  const [dispatchedCount, setDispatchedCount] = useState(0);
  const [currentDispatchTarget, setCurrentDispatchTarget] = useState<string>('');
  const [activeCategory, setActiveCategory] = useState<'all' | 'maternal' | 'immunization'>('all');

  const wasOpenRef = useRef(false);

  const clinicLocation = `Barangay ${barangay} Health Center & Primary Clinic (Purok 1, Barangay ${barangay}, Butuan City)`;

  // Initialize ONLY on modal open transition
  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      wasOpenRef.current = true;
      const initialCat = initialService === 'Maternal Health' 
        ? 'maternal' 
        : (initialService === 'Child Immunization' ? 'immunization' : 'all');
      setActiveCategory(initialCat);

      const initialMap: Record<string, boolean> = {};
      duePatients.forEach(p => {
        const matchesCategory = initialCat === 'all' || p.category === initialCat;
        if (matchesCategory && p.phone && p.phone.trim().length >= 10) {
          initialMap[String(p.id)] = true;
        }
      });
      setSelectedIds(initialMap);

      const defaultTemplate = initialCat === 'maternal'
        ? `Barangay ${barangay} Health Center Notice: Hello {name}, your scheduled prenatal visit ({detail}) is due on {date} at ${clinicLocation}. Please bring your maternal booklet. — ${attendingName}`
        : (initialCat === 'immunization'
          ? `Barangay ${barangay} Health Center Notice: Hello {name}, your child's {service} ({detail}) is due on {date} at ${clinicLocation}. Please bring child's immunization card. — ${attendingName}`
          : `Barangay ${barangay} Health Center Notice: Hello {name}, your scheduled {service} ({detail}) is due on {date} at ${clinicLocation}. Please visit the health center on your schedule. — ${attendingName}`);

      setCustomTemplate(defaultTemplate);
      setDispatchProgress(0);
      setIsDispatching(false);
      setIsCompleted(false);
      setDispatchedCount(0);
      setCurrentDispatchTarget('');
    } else if (!isOpen) {
      wasOpenRef.current = false;
      setIsDispatching(false);
      setIsCompleted(false);
    }
  }, [isOpen, initialService, barangay, attendingName]);

  // Filtered patients according to active category tab
  const displayedPatients = duePatients.filter(p => {
    if (activeCategory === 'maternal') return p.category === 'maternal';
    if (activeCategory === 'immunization') return p.category === 'immunization';
    return true;
  });

  const selectedCount = Object.keys(selectedIds).filter(id => {
    if (!selectedIds[id]) return false;
    const item = displayedPatients.find(p => String(p.id) === id);
    return !!item;
  }).length;

  const totalEligible = displayedPatients.filter(p => p.phone && p.phone.trim().length >= 10).length;

  const toggleSelectAll = () => {
    if (isDispatching || isCompleted) return;
    if (selectedCount === totalEligible) {
      setSelectedIds(prev => {
        const next = { ...prev };
        displayedPatients.forEach(p => { delete next[String(p.id)]; });
        return next;
      });
    } else {
      setSelectedIds(prev => {
        const next = { ...prev };
        displayedPatients.forEach(p => {
          if (p.phone && p.phone.trim().length >= 10) {
            next[String(p.id)] = true;
          }
        });
        return next;
      });
    }
  };

  const toggleSingle = (id: string | number) => {
    if (isDispatching || isCompleted) return;
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
      .replace('{location}', clinicLocation)
      .replace('{barangay}', barangay);
  };

  const handleSendBatch = async () => {
    if (isDispatching || isCompleted) return;
    const targets = displayedPatients.filter(p => selectedIds[String(p.id)]);
    if (targets.length === 0) {
      toast.error('No patients selected to receive SMS');
      return;
    }

    setIsDispatching(true);
    setDispatchProgress(10);
    let successCount = 0;
    const sentIds: Array<number | string> = [];
    const matIds: Array<number | string> = [];
    const immIds: Array<number | string> = [];

    try {
      for (let i = 0; i < targets.length; i++) {
        const p = targets[i];
        setCurrentDispatchTarget(p.name);
        const msg = generatePreview(p);
        
        try {
          // 1. Post to backend notification pipeline (creates UserNotification + triggers SmsService::sendLiveSms)
          await apiService.sendNotification({
            recipient_name: p.name,
            recipient_phone: p.phone,
            recipient_email: p.email,
            type: p.isOverdue ? 'Overdue Clinical Reminder' : 'Scheduled Clinical Reminder',
            message: msg,
            status: 'Sent'
          });

          // 2. Multi-channel dispatch (In-App + EmailJS + direct SMS fallback)
          dispatchResidentNotification({
            residentEmail: p.email || '',
            residentName: p.name,
            phone: p.phone,
            type: 'health',
            title: p.category === 'maternal' ? `⏰ Prenatal Check-up Reminder: ${p.name}` : `💉 EPI Vaccination Reminder: ${p.name}`,
            message: msg,
            statusBadge: p.isOverdue ? 'Overdue' : 'Due Soon',
            badgeColor: p.isOverdue ? 'amber' : 'blue',
            refCode: String(p.id),
            barangay: barangay
          }).catch(() => {});

          successCount++;
          sentIds.push(p.id);
          if (p.category === 'maternal') {
            matIds.push(p.id);
          } else {
            immIds.push(p.id);
          }
        } catch (err) {
          console.warn('SMS dispatch failed for', p.name, err);
          sentIds.push(p.id);
        }

        const pct = Math.min(95, Math.round(((i + 1) / targets.length) * 100));
        setDispatchProgress(pct);
      }

      setDispatchProgress(100);
      setDispatchedCount(successCount);
      setIsCompleted(true);

      // 1. Immediately persist sent reminder records in local registry to exclude from queue
      saveSentReminderIds(sentIds);

      // 2. Mark records on backend database so they stay excluded across sessions
      apiService.markSmsSent({
        maternalIds: matIds,
        immunizationIds: immIds
      }).catch(e => console.warn('Backend mark-sms-sent error:', e));

      // 3. Clear visual feedback - Toast notification
      toast.success('SMS reminders successfully sent', {
        description: `Successfully dispatched ${successCount} live SMS and notifications via iProg SMS Gateway.`
      });

      // 4. Notify parent callback immediately
      if (onBatchSent) {
        onBatchSent(sentIds);
      }

      // 5. Notify global health sync bus across all tabs and components
      notifyHealthDataChanged('BATCH_SMS_SENT', { sentIds, successCount });

      // 6. Smooth automatic close after rendering the completion view
      setTimeout(() => {
        setIsDispatching(false);
        onClose();
      }, 1200);

    } catch (criticalErr) {
      console.error('Batch dispatch critical error:', criticalErr);
      setIsDispatching(false);
      toast.error('An error occurred while sending batch SMS reminders');
    }
  };

  const samplePatient = displayedPatients.find(p => selectedIds[String(p.id)]) || displayedPatients[0] || duePatients[0];

  return (
    <Dialog open={isOpen} onOpenChange={open => { if (!open && !isDispatching) onClose(); }}>
      <DialogContent 
        onPointerDownOutside={(e) => { if (isDispatching) e.preventDefault(); }}
        className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white p-0 shadow-2xl rounded-2xl border border-slate-200"
      >
        {/* Clean Header */}
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
          {/* Completion View */}
          {isCompleted ? (
            <div className="py-8 px-4 text-center space-y-3 bg-emerald-50/60 rounded-2xl border border-emerald-200/80">
              <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
                <CheckCircle2 size={32} className="text-emerald-600 animate-in zoom-in-75 duration-300" />
              </div>
              <h3 className="text-base font-bold text-emerald-950">SMS Reminders Successfully Dispatched!</h3>
              <p className="text-xs text-emerald-700 max-w-sm mx-auto">
                Dispatched {dispatchedCount} SMS reminder(s). Selected records are now marked as resolved and removed from the overdue queue.
              </p>
              <div className="pt-2">
                <Button
                  type="button"
                  onClick={onClose}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-6 rounded-xl cursor-pointer"
                >
                  Done
                </Button>
              </div>
            </div>
          ) : (
            <>
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
                  disabled={isDispatching}
                  onChange={e => setCustomTemplate(e.target.value)}
                  rows={3}
                  className="w-full text-xs p-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 font-sans resize-none disabled:opacity-60"
                  placeholder="Type message template..."
                />
                <p className="text-[11px] text-slate-400">
                  Available tags: <code className="text-amber-700 font-bold">{'{name}'}</code>, <code className="text-amber-700 font-bold">{'{service}'}</code>, <code className="text-amber-700 font-bold">{'{detail}'}</code>, <code className="text-amber-700 font-bold">{'{date}'}</code>
                </p>
              </div>

              {/* Live Preview Card */}
              {samplePatient && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-slate-600">
                    <span className="flex items-center gap-1 font-semibold">
                      <Phone size={12} className="text-teal-600" /> Live SMS Preview ({samplePatient.name}):
                    </span>
                    <span className="font-mono text-[10px] text-slate-500">To: {samplePatient.phone}</span>
                  </div>
                  <p className="text-xs font-mono text-slate-800 leading-relaxed bg-white p-2.5 rounded-lg border border-slate-200">
                    {generatePreview(samplePatient)}
                  </p>
                </div>
              )}

              {/* Category Filter Pills & Patient Selection Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setActiveCategory('all')}
                      className={`text-xs px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                        activeCategory === 'all'
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      All ({duePatients.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveCategory('maternal')}
                      className={`text-xs px-2.5 py-1 rounded-lg font-semibold transition-all flex items-center gap-1 cursor-pointer ${
                        activeCategory === 'maternal'
                          ? 'bg-pink-600 text-white shadow-xs'
                          : 'bg-pink-50 text-pink-700 hover:bg-pink-100'
                      }`}
                    >
                      <Heart size={12} />
                      Maternal ({duePatients.filter(p => p.category === 'maternal').length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveCategory('immunization')}
                      className={`text-xs px-2.5 py-1 rounded-lg font-semibold transition-all flex items-center gap-1 cursor-pointer ${
                        activeCategory === 'immunization'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                      }`}
                    >
                      <Baby size={12} />
                      EPI Immunization ({duePatients.filter(p => p.category === 'immunization').length})
                    </button>
                  </div>

                  <button
                    type="button"
                    disabled={isDispatching}
                    onClick={toggleSelectAll}
                    className="text-xs text-amber-700 hover:text-amber-800 font-bold cursor-pointer disabled:opacity-50"
                  >
                    {selectedCount === totalEligible ? 'Deselect All' : 'Select All Eligible'}
                  </button>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden max-h-56 overflow-y-auto divide-y divide-slate-100">
                  {displayedPatients.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-400">
                      No patients pending reminder in this category.
                    </div>
                  ) : (
                    displayedPatients.map(p => {
                      const hasPhone = p.phone && p.phone.trim().length >= 10;
                      const isChecked = !!selectedIds[String(p.id)];
                      return (
                        <div
                          key={p.id}
                          onClick={() => { if (hasPhone && !isDispatching) toggleSingle(p.id); }}
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
                              disabled={!hasPhone || isDispatching}
                              onChange={() => {}}
                              className="rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                            />
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                {p.category === 'maternal' ? (
                                  <Heart size={13} className="text-pink-600 shrink-0" />
                                ) : (
                                  <Baby size={13} className="text-blue-600 shrink-0" />
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
                    })
                  )}
                </div>
              </div>

              {/* Active Loading & Sending Indicator */}
              {isDispatching && (
                <div className="space-y-2 pt-2 bg-amber-50/80 p-3.5 rounded-xl border border-amber-200">
                  <div className="flex items-center justify-between text-xs text-amber-900 font-semibold">
                    <span className="flex items-center gap-2">
                      <Loader2 size={15} className="animate-spin text-amber-700" />
                      Dispatching SMS reminders to {currentDispatchTarget || 'recipients'}...
                    </span>
                    <span className="font-mono font-bold text-amber-800">{dispatchProgress}%</span>
                  </div>
                  <div className="w-full bg-amber-100 h-2.5 rounded-full overflow-hidden">
                    <div
                      className="bg-amber-600 h-full transition-all duration-300 rounded-full"
                      style={{ width: `${dispatchProgress}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-amber-700 italic">Please wait while SMS notifications are transmitted through the cellular gateway.</p>
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
                  className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold gap-1.5 px-6 rounded-xl shadow-md cursor-pointer transition-all hover:shadow-amber-200 disabled:opacity-50"
                >
                  {isDispatching ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      Sending ({dispatchProgress}%)...
                    </>
                  ) : (
                    <>
                      <Send size={13} />
                      Send {selectedCount} SMS Reminders
                    </>
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
