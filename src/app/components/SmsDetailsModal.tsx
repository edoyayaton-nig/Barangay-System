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
  Smartphone,
  Calendar,
  User,
  CheckCircle2,
  Send,
  MessageSquare,
  ShieldCheck
} from 'lucide-react';
import { SmsNotification } from '../../services/api';

interface SmsDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  notification: SmsNotification | null;
  onComposeReply?: (recipient: string, phone: string) => void;
}

export default function SmsDetailsModal({
  isOpen,
  onClose,
  notification,
  onComposeReply
}: SmsDetailsModalProps) {
  if (!notification) return null;

  const formattedDate = notification.sent_at
    ? new Date(notification.sent_at).toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short'
      })
    : 'Recent';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl rounded-2xl p-6">
        <DialogHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center">
                <Smartphone size={18} />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-slate-900 dark:text-white">
                  SMS Notification Record
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  Official SMS dispatch log & message content
                </DialogDescription>
              </div>
            </div>
            <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white text-[11px] gap-1 px-2.5 py-0.5">
              <CheckCircle2 size={12} />
              {notification.status || 'Sent'}
            </Badge>
          </div>
        </DialogHeader>

        {/* Recipient & Metadata Grid */}
        <div className="grid grid-cols-2 gap-3 py-3 text-xs bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
          <div className="space-y-1">
            <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1">
              <User size={12} /> Recipient Name
            </span>
            <p className="font-semibold text-slate-900 dark:text-white text-sm">
              {notification.recipient_name || 'N/A'}
            </p>
          </div>

          <div className="space-y-1">
            <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1">
              <Smartphone size={12} /> Mobile Phone
            </span>
            <p className="font-mono font-semibold text-blue-600 dark:text-blue-400 text-sm">
              {notification.recipient_phone || 'N/A'}
            </p>
          </div>

          <div className="space-y-1">
            <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1">
              <ShieldCheck size={12} /> Alert Type
            </span>
            <Badge variant="outline" className="font-medium text-[11px] bg-white dark:bg-slate-900 border-slate-200">
              {notification.type || 'General Notice'}
            </Badge>
          </div>

          <div className="space-y-1">
            <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1">
              <Calendar size={12} /> Dispatched At
            </span>
            <p className="text-slate-600 dark:text-slate-400 font-mono text-[11px]">
              {formattedDate}
            </p>
          </div>
        </div>

        {/* Message Content Preview (Phone Message Bubble Style) */}
        <div className="space-y-2 py-2">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <MessageSquare size={13} className="text-blue-500" />
            Full Dispatched SMS Message:
          </label>
          <div className="relative bg-gradient-to-br from-blue-600 to-indigo-700 text-white p-4 rounded-2xl rounded-tl-sm shadow-md text-xs sm:text-sm leading-relaxed whitespace-pre-wrap font-sans">
            <p>{notification.message}</p>
            <div className="mt-3 pt-2 border-t border-white/20 flex items-center justify-between text-[10px] text-blue-100">
              <span>Sender: BARANGAY {(notification as any).barangay?.toUpperCase() || 'CIVIL REGISTRY'}</span>
              <span>Delivered via SMS Gateway</span>
            </div>
          </div>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          {onComposeReply && (
            <Button
              onClick={() => {
                onClose();
                onComposeReply(notification.recipient_name, notification.recipient_phone);
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs gap-1.5"
            >
              <Send size={13} />
              Send Follow-up SMS
            </Button>
          )}
          <Button
            variant="outline"
            onClick={onClose}
            className="text-xs border-slate-200 text-slate-700 hover:bg-slate-100"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
