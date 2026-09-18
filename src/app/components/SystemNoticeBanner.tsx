import { useState, useEffect } from 'react';
import { 
  AlertOctagon, 
  AlertTriangle, 
  Info, 
  Clock, 
  Wrench, 
  WifiOff, 
  X, 
  ChevronRight,
  ShieldAlert
} from 'lucide-react';
import { apiService } from '../../services/api';

export interface SystemNoticeData {
  enabled: boolean;
  type?: 'down' | 'maintenance' | 'advisory';
  title?: string;
  message?: string;
  estimated_uptime?: string;
  updated_at?: string;
}

interface SystemNoticeBannerProps {
  customNotice?: SystemNoticeData | null;
  allowDismiss?: boolean;
  showStaffButton?: boolean;
  onStaffClick?: () => void;
  className?: string;
}

export default function SystemNoticeBanner({
  customNotice,
  allowDismiss = true,
  showStaffButton = false,
  onStaffClick,
  className = ''
}: SystemNoticeBannerProps) {
  const [notice, setNotice] = useState<SystemNoticeData | null>(customNotice || null);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    if (customNotice !== undefined) {
      setNotice(customNotice);
      setIsDismissed(false);
      return;
    }

    let isMounted = true;
    const fetchNotice = async () => {
      try {
        const data = await apiService.getMaintenanceMode();
        if (isMounted && data) {
          setNotice(data);
        }
      } catch (err) {
        console.warn('Unable to load live system notice from server:', err);
      }
    };

    fetchNotice();
    const interval = setInterval(fetchNotice, 30000); // refresh every 30s

    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      isMounted = false;
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [customNotice]);

  // Offline detection takes highest emergency precedence
  if (isOffline) {
    return (
      <div className={`bg-rose-950 text-white border-b border-rose-800 py-2.5 px-4 z-50 shadow-md ${className}`}>
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-rose-900 flex items-center justify-center shrink-0">
              <WifiOff size={16} className="text-rose-300 animate-pulse" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-rose-300">
                Network Disconnected
              </p>
              <p className="text-xs text-rose-100">
                Your device lost connection to the network. Please check your internet or municipal intranet connection.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!notice || !notice.enabled || isDismissed) {
    return null;
  }

  const noticeType = notice.type || 'down';

  // Configuration based on notice type
  const config = {
    down: {
      bg: 'bg-gradient-to-r from-red-700 via-rose-700 to-red-800 border-red-900',
      badgeBg: 'bg-white/20 text-white border border-white/30',
      icon: AlertOctagon,
      iconBg: 'bg-red-950/40 text-red-200 ring-2 ring-red-400/30',
      defaultTitle: 'SYSTEM OUTAGE ALERT — SYSTEM IS CURRENTLY DOWN',
      defaultMessage: 'The Barangay Information System is experiencing an unscheduled server outage. Online document submissions, verification, and appointment booking are temporarily offline.',
      badgeText: 'CRITICAL SYSTEM OUTAGE',
      showPulse: true
    },
    maintenance: {
      bg: 'bg-gradient-to-r from-amber-600 via-amber-500 to-orange-600 border-amber-700',
      badgeBg: 'bg-black/20 text-amber-50 border border-white/20',
      icon: Wrench,
      iconBg: 'bg-black/20 text-amber-200',
      defaultTitle: 'SCHEDULED SYSTEM MAINTENANCE IN PROGRESS',
      defaultMessage: 'System databases and municipal servers are currently undergoing scheduled maintenance to upgrade security and performance.',
      badgeText: 'SCHEDULED MAINTENANCE',
      showPulse: false
    },
    advisory: {
      bg: 'bg-gradient-to-r from-blue-700 via-indigo-700 to-sky-800 border-indigo-900',
      badgeBg: 'bg-white/20 text-sky-100 border border-white/30',
      icon: Info,
      iconBg: 'bg-indigo-950/40 text-sky-200',
      defaultTitle: 'OFFICIAL MUNICIPAL SYSTEM ADVISORY',
      defaultMessage: 'Please review official announcements regarding barangay hall operations, clinic schedules, and civil registration.',
      badgeText: 'MUNICIPAL ADVISORY',
      showPulse: false
    }
  }[noticeType];

  const IconComponent = config.icon;

  return (
    <div className={`${config.bg} text-white shadow-lg border-b z-50 transition-all duration-300 ${className}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-start sm:items-center gap-3 w-full sm:w-auto">
          {/* Animated Icon */}
          <div className={`w-9 h-9 rounded-xl ${config.iconBg} flex items-center justify-center shrink-0 shadow-inner mt-0.5 sm:mt-0`}>
            <IconComponent size={20} className={config.showPulse ? 'animate-bounce' : ''} />
          </div>

          <div className="flex-1 min-w-0">
            {/* Header / Badges */}
            <div className="flex flex-wrap items-center gap-2 mb-0.5">
              <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${config.badgeBg}`}>
                {config.badgeText}
              </span>
              
              {notice.title && (
                <span className="text-xs font-bold text-white tracking-wide">
                  {notice.title}
                </span>
              )}

              {notice.estimated_uptime && (
                <span className="text-[11px] font-medium text-white/90 bg-black/25 px-2 py-0.5 rounded-md flex items-center gap-1">
                  <Clock size={12} className="text-white/80" />
                  {notice.estimated_uptime}
                </span>
              )}
            </div>

            {/* Main Message */}
            <p className="text-xs sm:text-sm font-medium text-white/95 leading-snug">
              {notice.message || config.defaultMessage}
            </p>
          </div>
        </div>

        {/* Action / Dismiss Buttons */}
        <div className="shrink-0 flex items-center gap-2 self-end sm:self-center">
          {showStaffButton && onStaffClick && (
            <button
              type="button"
              onClick={onStaffClick}
              className="h-7 px-3 text-xs bg-white/20 hover:bg-white/30 text-white border border-white/30 rounded-lg font-semibold flex items-center gap-1 transition-all cursor-pointer shadow-xs"
            >
              Staff Portal Access
              <ChevronRight size={13} />
            </button>
          )}

          {allowDismiss && noticeType !== 'down' && (
            <button
              type="button"
              onClick={() => setIsDismissed(true)}
              title="Dismiss notice for this session"
              className="p-1 rounded-md text-white/70 hover:text-white hover:bg-white/20 transition-all cursor-pointer"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
