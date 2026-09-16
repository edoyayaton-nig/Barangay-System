import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from './ui/dialog';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import {
  FileText,
  User,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Building2,
  Printer,
  Shield,
  MapPin,
  ClipboardList
} from 'lucide-react';
import { DocumentRequest } from '../../services/api';

interface DocumentInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: DocumentRequest | null;
  onUpdateStatus?: (id: number, currentStatus: string) => void;
  onPrint?: (document: DocumentRequest) => void;
  canEdit?: boolean;
}

export default function DocumentInfoModal({
  isOpen,
  onClose,
  document: doc,
  onUpdateStatus,
  onPrint,
  canEdit = true
}: DocumentInfoModalProps) {
  if (!doc) return null;

  // Helper to parse purpose string into key-value pairs if it was submitted as structured text
  const parsePurposeFields = (purposeText?: string) => {
    if (!purposeText) return [];
    if (purposeText.includes(' | ') || purposeText.includes(': ')) {
      const parts = purposeText.split(' | ');
      const parsed: { label: string; value: string }[] = [];
      for (const part of parts) {
        const colonIdx = part.indexOf(':');
        if (colonIdx > 0) {
          parsed.push({
            label: part.substring(0, colonIdx).trim(),
            value: part.substring(colonIdx + 1).trim()
          });
        } else {
          parsed.push({ label: 'Details', value: part.trim() });
        }
      }
      if (parsed.length > 0) return parsed;
    }
    return [{ label: 'Purpose / Reason', value: purposeText }];
  };

  const parsedFields = parsePurposeFields(doc.purpose);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-white dark:bg-slate-900 w-[92vw] max-w-2xl max-h-[85vh] overflow-y-auto shadow-2xl border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5">
        <DialogHeader className="border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-400 flex items-center justify-center">
                <FileText size={20} />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>{doc.document_type}</span>
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 font-mono">
                  Code: <span className="font-bold text-indigo-600 dark:text-indigo-400">{doc.request_code}</span>
                </DialogDescription>
              </div>
            </div>
            <Badge
              className={
                doc.status === 'Completed'
                  ? 'bg-emerald-600 text-white'
                  : doc.status === 'Processing'
                  ? 'bg-amber-500 text-white'
                  : 'bg-orange-500 text-white'
              }
            >
              {doc.status}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          {/* Resident Overview Card */}
          <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
              <span className="text-slate-500 font-medium flex items-center gap-1.5">
                <User size={14} className="text-indigo-600" />
                Applicant / Resident Name:
              </span>
              <span className="font-bold text-slate-900 dark:text-white text-sm">
                {doc.resident_name}
              </span>
            </div>

            <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
              <span className="text-slate-500 font-medium flex items-center gap-1.5">
                <MapPin size={14} className="text-rose-500" />
                Official Address:
              </span>
              <span className="font-semibold text-right">
                Barangay Pianing, Butuan City, 8600
              </span>
            </div>

            <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
              <span className="text-slate-500 font-medium flex items-center gap-1.5">
                <Calendar size={14} className="text-blue-500" />
                Date Requested:
              </span>
              <span className="font-mono">{doc.requested_at || 'Recent'}</span>
            </div>

            {doc.processed_at && (
              <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                <span className="text-slate-500 font-medium flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-emerald-500" />
                  Processed At:
                </span>
                <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                  {doc.processed_at} {doc.processed_by ? `by ${doc.processed_by}` : ''}
                </span>
              </div>
            )}
          </div>

          {/* Form Submitted Specific Fields */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wide">
              <ClipboardList size={15} className="text-indigo-600" />
              Application Form Specifics
            </div>

            <div className="grid grid-cols-1 gap-2">
              {parsedFields.map((field, idx) => (
                <div
                  key={idx}
                  className="bg-white dark:bg-slate-800 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-1 shadow-2xs"
                >
                  <span className="text-slate-500 dark:text-slate-400 font-semibold text-[11px]">
                    {field.label}
                  </span>
                  <span className="font-bold text-slate-800 dark:text-slate-100 text-xs text-left sm:text-right">
                    {field.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="border-t border-slate-100 dark:border-slate-800 pt-3 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {onPrint && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  onClose();
                  onPrint(doc);
                }}
                className="text-xs border-indigo-200 text-indigo-700 hover:bg-indigo-50 flex items-center gap-1.5 w-full sm:w-auto"
              >
                <Printer size={14} />
                Print / Export
              </Button>
            )}

            {canEdit && onUpdateStatus && doc.status !== 'Completed' && (
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  onUpdateStatus(doc.id, doc.status);
                  onClose();
                }}
                className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center gap-1.5 w-full sm:w-auto"
              >
                <CheckCircle2 size={14} />
                {doc.status === 'Pending' ? 'Mark as Processing' : 'Mark as Completed'}
              </Button>
            )}
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-xs text-slate-500 hover:bg-slate-100 w-full sm:w-auto"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
