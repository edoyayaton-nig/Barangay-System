import { useState, useEffect, useRef } from 'react';
import { Bot, Send, X, Sparkles, ArrowDown, Trash2 } from 'lucide-react';
import { apiService } from '../../services/api';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';

interface ChatMessage {
  sender: 'user' | 'bot';
  text: string;
  topic?: string;
  timestamp?: Date;
}

function formatBotText(text: string) {
  // Convert *bold* to <strong>, newlines to <br>, and preserve emoji
  const lines = text.split('\n');
  return lines.map((line, i) => {
    const formatted = line.replace(/\*([^*]+)\*/g, '<strong>$1</strong>');
    return (
      <span key={i}>
        <span dangerouslySetInnerHTML={{ __html: formatted }} />
        {i < lines.length - 1 && <br />}
      </span>
    );
  });
}

const CLIENT_KNOWLEDGE_BASE = [
  {
    topic: 'Barangay Clearance',
    keywords: ['clearance', 'barangay clearance', 'kuha clearance', 'police clearance', 'nbi clearance', 'clearance requirements', 'unsaon pagkuha og clearance', 'paano kumuha ng clearance', 'requirements clearance'],
    answer: `📄 *Barangay Clearance Requirements & Procedure:*\n\n✅ *Requirements:*\n• 1 Valid Government-Issued ID (PhilSys, Voter's ID, Driver's License, Postal ID, Passport)\n• Community Tax Certificate (Cedula) — available at Barangay Hall Cashier\n• Proof of Residency in Barangay Pianing (utility bill or lease)\n• Purpose of request (Employment, Bank, Travel, Postal ID, etc.)\n\n🕐 *Processing Time:* Same day (15–30 minutes)\n💰 *Official Fee:* Php 50.00\n📍 *Where:* Barangay Hall, Room 1 – Document Section\n\n💡 *Online Request:* Verified residents can request directly via the *Barangay Portal* in this system to avoid queueing!`
  },
  {
    topic: 'Certificate of Residency',
    keywords: ['residency', 'certificate of residency', 'proof of residency', 'proof of residence', 'patunay ng paninirahan', 'residente'],
    answer: `🏠 *Certificate of Residency Requirements:*\n\n✅ *Requirements:*\n• Valid Government ID showing your Barangay Pianing address\n• Recent Utility Bill (ANECO electricity or water bill) within the last 3 months\n• Proof of living in Barangay Pianing for at least 6 months\n• 1 pc 2x2 or 1x1 ID photo (if requested for file record)\n\n🕐 *Processing Time:* Same day (15–30 minutes)\n💰 *Official Fee:* Php 50.00\n📍 *Where:* Barangay Hall – Records Section\n\n💡 You can submit this request online directly through your *Resident Portal*!`
  },
  {
    topic: 'Certificate of Indigency',
    keywords: ['indigency', 'certificate of indigency', 'indigent', 'financial assistance', 'medical assistance', 'tulong', 'bursary', 'scholarship', '4ps', 'libre', 'walang pambayad'],
    answer: `📋 *Certificate of Indigency (100% FREE):*\n\n✅ *Requirements:*\n• Valid Government ID of the requesting resident / beneficiary\n• Purok recommendation or confirmation of indigent residency\n• Statement of Purpose (Medical Assistance at Butuan Medical Center, PCSO, DSWD, Public Attorney's Office, Scholarship, or Funeral Assistance)\n\n🕐 *Processing Time:* Same day\n💰 *Official Fee:* **FREE / No Charge** (Exempted under government regulations)\n📍 *Where:* Barangay Hall – Indigent & Social Welfare Desk\n\n💡 Verified indigent residents can also request this free certificate online via the *Resident Portal*.`
  },
  {
    topic: 'Business Permit & Clearance',
    keywords: ['business permit', 'business clearance', 'business', 'negosyo', 'sari-sari', 'store', 'commercial permit', 'tindahan', 'permit'],
    answer: `🏪 *Barangay Business Clearance Requirements:*\n\n✅ *Requirements:*\n• DTI Registration (for Sole Proprietorship) or SEC Registration (for Corporations)\n• Lease Contract or Land Title / Owner's Consent Letter\n• Valid Government ID of the Business Owner\n• Community Tax Certificate (Cedula)\n• Previous Year Barangay Business Permit (for renewals)\n\n🕐 *Processing Time:* 1–2 business days (subject to site inspection)\n💰 *Official Fee:* Php 200.00 – Php 500.00 (based on business classification)\n📍 *Where:* Barangay Hall – Treasury & Business Licensing Section`
  },
  {
    topic: 'Barangay ID',
    keywords: ['barangay id', 'id card', 'valid id', 'identification', 'kuha id', 'barangay identification'],
    answer: `🪪 *Barangay ID Requirements:*\n\n✅ *Requirements:*\n• Proof of residency in Barangay Pianing for at least 6 months\n• 2 pcs recent 2x2 ID photos with white background\n• Valid supporting ID or Birth Certificate (PSA)\n• Accomplished Barangay ID Application Form\n\n🕐 *Processing Time:* 1–3 business days\n💰 *Official Fee:* Php 50.00\n📍 *Where:* Barangay Hall – IT & ID Issuance Desk`
  },
  {
    topic: 'First Time Jobseeker Certificate',
    keywords: ['jobseeker', 'first time jobseeker', 'ra 11261', 'first job', 'fresh graduate', 'job seeker'],
    answer: `🎓 *First Time Jobseeker Certificate (Republic Act 11261):*\n\nUnder RA 11261, first-time jobseekers are **EXEMPT** from government fees for clearances and certificates!\n\n✅ *Requirements:*\n• Oath of Undertaking (provided at Barangay Hall)\n• Valid ID or School ID / Transcript / Diploma\n• Barangay Certification confirming first-time jobseeker status\n\n💰 *Official Fee:* **100% FREE**\n📍 *Where:* Barangay Hall – Youth & Employment Desk`
  },
  {
    topic: 'Special Certifications',
    keywords: ['employment', 'certificate of employment', 'land occupancy', 'good moral', 'solo parent', 'activity permit', 'occupancy'],
    answer: `📜 *Special Barangay Certifications Available:*\n\n• *Certificate of Land Occupancy:* For MERALCO/ANECO electric meter or building connection. (Fee: Php 100.00)\n• *Certificate of Good Moral:* For employment, school transfer, or legal requirements. (Fee: Php 50.00)\n• *Solo Parent Certification:* For DSWD Solo Parent ID qualification. (Fee: FREE)\n• *Barangay Activity Permit:* For community assemblies, sports events, or transport operations. (Fee: Php 100.00)\n\n📍 Request via the *Barangay Portal* or the Barangay Hall Front Desk.`
  },
  {
    topic: 'Fees & Payment Guide',
    keywords: ['fee', 'fees', 'magkano', 'pila', 'bayad', 'cost', 'price', 'payment', 'cashier', 'how much', 'what are the fees'],
    answer: `💰 *Barangay Pianing Official Schedule of Fees:*\n\n• *Barangay Clearance:* Php 50.00\n• *Certificate of Residency:* Php 50.00\n• *Barangay ID Card:* Php 50.00\n• *Business Permit / Clearance:* Php 200.00 – Php 500.00\n• *Land Occupancy / Activity Permit:* Php 100.00\n• *Certificate of Indigency:* **FREE / Walang Bayad**\n• *First Time Jobseeker Certificate:* **FREE (RA 11261)**\n• *All Health Center Services:* **100% FREE**\n\n💳 *Payment Method:* Cash at the Barangay Hall Cashier upon document release, or confirmed online.`
  },
  {
    topic: 'EPI Child Immunization Schedule',
    keywords: ['vaccine', 'vaccines', 'vaccination', 'immunization', 'bakuna', 'turok', 'schedule sa bakuna', 'free vaccine', 'infant', 'baby', 'child', 'bcg', 'polio', 'mmr', 'hepatitis', 'pentavalent', 'dpt', 'pcv', 'free vaccine schedule'],
    answer: `💉 *Free Infant & Child Immunization Schedule (EPI):*\n\n📅 *Clinic Schedule:* Every **Wednesday & Friday**, 8:00 AM – 12:00 PM\n📍 *Location:* Barangay Pianing Health Center\n\n🛡️ *Available Free DOH Vaccines:*\n• *BCG & Hepatitis B:* Given at birth / early infancy\n• *Pentavalent (DPT-HepB-Hib):* 6, 10, and 14 weeks\n• *OPV / IPV (Oral & Injected Polio):* 6, 10, 14 weeks & 9 months\n• *PCV (Pneumococcal Conjugate):* 6, 10, and 14 weeks\n• *MMR (Measles, Mumps, Rubella):* 9 months and 12 months\n\n📋 *Please bring:* Baby Book / Mother-Child Health Record.\n\n💡 *SMS Alert:* Registered parents receive automated SMS reminders before upcoming vaccine schedules!`
  },
  {
    topic: 'Maternal & Prenatal Health Care',
    keywords: ['prenatal', 'pregnant', 'pregnancy', 'maternal', 'buntis', 'pa-checkup', 'ultrasound', 'postnatal', 'ob-gyn', 'midwife', 'nurse', 'prenatal care services', 'prenatal care'],
    answer: `🤰 *Maternal & Prenatal Care Services (FREE):*\n\n🏥 *Services Available:*\n• Routine Prenatal & Postnatal Checkups with Nurse & Rural Health Midwife\n• Blood Pressure, Maternal Weight, and Fundic Height monitoring\n• Free Iron + Folic Acid and Calcium Supplements\n• Tetanus-Diphtheria (Td) immunization for mothers\n• High-Risk Pregnancy Screening and referral to Butuan Medical Center\n\n📅 *Schedule:* Monday to Friday, 8:00 AM – 5:00 PM\n📍 *Location:* Barangay Pianing Health Station – Maternal Room\n\n📋 *Please bring:* Mother-Baby Handbook and previous laboratory results.`
  },
  {
    topic: 'Health Center Services & Hours',
    keywords: ['health center', 'clinic', 'consultation', 'doctor', 'nurse', 'bhw', 'checkup', 'oras sa clinic', 'health station', 'general consultation', 'health services'],
    answer: `🏥 *Barangay Pianing Health Center Services & Hours:*\n\n🕐 *Operating Hours:* Monday – Friday: **8:00 AM – 5:00 PM**\n❌ Closed on Saturdays, Sundays, and Official Public Holidays\n\n🩺 *Available Free Services:*\n• General Medical Consultations & Triage\n• Vital Signs (BP, Blood Glucose, Temperature, Pulse)\n• Free Essential Maintenance Medicines & Vitamins (subject to stock)\n• Pediatric Deworming and Nutritional Guidance\n• Medical Certificates & Health Clearances\n\n📍 *Location:* Barangay Hall Compound, Health Center Annex Building\n📞 *Hotline:* (085) 341-2345 / 0919-876-5432`
  },
  {
    topic: 'Free Medicines & Pharmacy',
    keywords: ['medicine', 'medicines', 'gamot', 'tambal', 'libre nga tambal', 'paracetamol', 'antibiotic', 'vitamins', 'pharmacy', 'supply'],
    answer: `💊 *Free Medicines & Medical Supplies:*\n\nThe Barangay Health Station dispenses free essential medications provided by DOH & City Health Office:\n• *Fever & Pain:* Paracetamol (tablets & oral suspension)\n• *Cough & Cold:* Carbocisteine, Salbutamol for nebulization\n• *Hypertension:* Amlodipine, Losartan (with prescription)\n• *Nutritional:* Vitamin A, Iron drops, Zinc, Deworming tablets\n\n📋 *How to claim:* Visit the health station for clinical assessment or present a valid prescription from a government doctor.`
  },
  {
    topic: 'Clinic Appointment Booking',
    keywords: ['appointment', 'book appointment', 'schedule appointment', 'pa-appointment', 'reserva', 'clinic schedule'],
    answer: `🗓️ *How to Book a Health Center Appointment:*\n\n1. Log in to your *Resident Account* on this portal\n2. Navigate to the *Health Center Portal*\n3. Click *\"Book Clinic Appointment\"*\n4. Select the service: Prenatal Care, Immunization, or General Consultation\n5. Choose your preferred date and available time slot\n6. Confirm your booking!\n\n📱 *SMS Reminder:* You will receive an automated text confirmation and a 24-hour reminder before your scheduled visit.`
  },
  {
    topic: 'Resident Account Registration',
    keywords: ['register', 'sign up', 'create account', 'unsaon pag register', 'paano mag register', 'census record', 'new account', 'existing resident', 'how to register', 'how to register an account'],
    answer: `📝 *How to Register a Resident Account:*\n\n1. Open the *Login Page* and select the **Create Account** tab.\n2. Choose your registration path:\n   • **Existing Census Resident (Fast-Track):** If you are already listed in the official Barangay Pianing census, search your Full Name and Purok to auto-fill and activate your account immediately!\n   • **New Resident:** If you recently moved to Barangay Pianing, fill out the form and upload a clear photo of your valid Government ID.\n3. Submit your registration!\n\n⏳ *Verification:* The Barangay Secretary will review and activate your account within 24 hours. You'll receive an SMS/Email alert upon approval!`
  },
  {
    topic: 'Account Verification Guide',
    keywords: ['verify', 'verification', 'pending review', 'rejected', 'unverified', 'na-reject', 'account locked', 'locked', 'approval'],
    answer: `🛡️ *Account Verification & Status Guide:*\n\n• *Why is my account Pending?* Accounts are reviewed within 24 to 48 hours to confirm genuine residency in Barangay Pianing.\n• *Why can't I request documents yet?* Unverified accounts are locked from requesting documents online to prevent identity fraud.\n• *What if my registration was Rejected?* View the reason in your portal. Click *\"Resubmit Application\"* to upload a clearer ID photo or correct any details.\n\n🏢 Need urgent approval? Visit the Barangay Hall Front Desk with your physical valid ID for instant activation!`
  },
  {
    topic: 'Office Hours & Schedule',
    keywords: ['hours', 'office hours', 'open', 'schedule', 'oras', 'abli', 'what time', 'operating hours', 'adlaw', 'what time open', 'office hours?'],
    answer: `🕐 *Barangay Pianing Official Operating Hours:*\n\n🏛️ *Barangay Hall Administrative Offices:*\n• Monday – Friday: **8:00 AM – 5:00 PM** (Continuous frontline service)\n• Saturday: **8:00 AM – 12:00 PM** (Frontline assistance desk)\n• Sunday & Public Holidays: **Closed**\n\n🏥 *Barangay Health Center:*\n• Monday – Friday: **8:00 AM – 5:00 PM**\n• Child Immunization: Wednesdays & Fridays (8:00 AM – 12:00 PM)\n\n🚨 *Barangay Tanod & Emergency Assistance:* **24/7 Active**`
  },
  {
    topic: 'Contact & Location Information',
    keywords: ['contact', 'phone', 'hotline', 'address', 'location', 'where', 'asa dapit', 'email', 'emergency', 'number', 'telepono', 'contact info'],
    answer: `📞 *Barangay Pianing Official Directory:*\n\n🏛️ *Physical Address:*\nBarangay Hall, Barangay Pianing, Butuan City, Agusan del Norte, Caraga Region XIII, 8600 Philippines\n\n☎️ *Official Hotlines:*\n• Barangay Hall Front Desk: **0917-890-1234** / (085) 341-2345\n• Health Center Desk: **0919-876-5432**\n• Barangay Emergency & Tanod Desk: **0917-111-2233** (24/7)\n• Official Email: **barangay.pianing.butuan@gmail.com**\n\n🚨 *Butuan City Emergency Numbers:*\n• Butuan CDRRMO Rescue: (085) 342-5555 / 911\n• Butuan City Police Station: (085) 815-1234\n• Butuan City Medical Center (BCMC): (085) 341-1111`
  },
  {
    topic: 'Document Request Tracking',
    keywords: ['track', 'status', 'check status', 'pending request', 'ready for pickup', 'claim', 'asan na', 'kanus-a makuha', 'status request'],
    answer: `🔍 *How to Track Your Document Request:*\n\n1. Log in to your *Resident Portal*\n2. Go to the *\"My Document Requests\"* table on your dashboard\n3. Look at your real-time status badge:\n   • 🟡 *Pending Review:* Awaiting review by the Barangay Secretary\n   • 🔵 *Processing:* Document is being prepared and certified\n   • 🟢 *Ready for Pickup:* Signed and sealed! Bring your valid ID to claim at Room 1\n   • 🟣 *Released / Completed:* Formally released to you\n\n📱 You will also receive an automated SMS notification as soon as your document is marked Ready for Pickup!`
  },
  {
    topic: 'Printing & PDF Documents',
    keywords: ['print', 'download', 'pdf', 'digital certificate', 'qr code', 'copy', 'unsaon pag print', 'how to print', 'how to print my document'],
    answer: `🖨️ *Downloading & Printing Your Digital Document:*\n\n1. Log in and go to your *Resident Portal* dashboard\n2. Scroll down to *\"My Document Requests\"*\n3. For approved requests, click the *\"Download PDF\"* or *\"Print\"* button\n4. Your official document will open with an authentic seal and verification QR code!\n\n💡 You can print this directly or present the downloaded digital copy with its QR verification code to requesting employers, schools, or agencies.`
  },
  {
    topic: 'Account Recovery & Password Reset',
    keywords: ['password', 'forgot password', 'reset password', 'recover', 'kalimutan ang password', 'login issue', 'cannot login', 'change password'],
    answer: `🔑 *Forgot Password & Account Recovery:*\n\n1. Go to the *Login Page*\n2. Click the *\"Forgot Password?\"* link next to the password input field\n3. Enter your registered email address\n4. Follow the reset link sent to your inbox\n\n💡 Alternatively, visit the Barangay Hall Admin desk or message the barangay administrator to reset your password directly.`
  },
  {
    topic: 'Barangay AI Assistant',
    keywords: ['hello', 'hi', 'hey', 'kumusta', 'maayong adlaw', 'good morning', 'good afternoon', 'good evening', 'help', 'unsa imong mabuhat', 'ano ang magagawa mo', 'who are you', 'sino ka'],
    answer: `👋 *Magandang araw! Maayong adlaw!*\n\nI am your official **Barangay Pianing AI Assistant**. I'm here 24/7 to help you with:\n• 📄 *Clearances & Documents:* Requirements, fees, and processing times\n• 🏥 *Health Center Services:* Free checkups, prenatal care, and clinic hours\n• 💉 *Child Immunization:* Free vaccine schedules and requirements\n• 📝 *Resident Accounts:* Registration, verification, and status tracking\n• 📞 *Contact & Location:* Hotlines, office hours, and emergency contacts\n\nHow can I help you today? Feel free to ask a question or tap one of the quick pills below!`
  }
];

function findClientAnswer(question: string): { topic: string; answer: string } | null {
  const clean = question.toLowerCase().replace(/^[📄💉🕐🏪🤰💰📝🖨️]\s*/u, '').trim();
  if (!clean) return null;

  const words = clean.split(/\s+/).filter(w => w.length >= 3);
  let bestMatch: { topic: string; answer: string } | null = null;
  let bestScore = 0;

  for (const item of CLIENT_KNOWLEDGE_BASE) {
    let score = 0;
    for (const kw of item.keywords) {
      const lowerKw = kw.toLowerCase();
      if (clean.includes(lowerKw)) {
        score += lowerKw.length >= 5 ? 25 : 15;
      }
      for (const w of words) {
        if (lowerKw.includes(w)) {
          score += 8;
        }
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = item;
    }
  }

  return bestScore >= 8 ? bestMatch : null;
}

const QUICK_QUESTIONS = [
  '📄 Barangay Clearance requirements?',
  '💉 Free vaccine schedule?',
  '🕐 Office hours?',
  '🏪 Business permit requirements?',
  '🤰 Prenatal care services?',
  '💰 What are the fees?',
  '📝 How to register an account?',
  '🖨️ How to print my document?',
];

const INITIAL_WELCOME: ChatMessage = {
  sender: 'bot',
  text: 'Magandang araw! 👋 I am your *Smart Barangay Assistant*.\n\nI can help you with:\n📄 Document requests & requirements\n🏥 Health center services & schedules\n💉 Free immunization information\n🕐 Office hours & contact info\n\nHow can I assist you today?',
  topic: 'Welcome',
  timestamp: new Date()
};

export default function BarangayChatbot() {
  const [isOpen, setIsOpen] = useState(() => {
    try {
      return localStorage.getItem('barangay_chatbot_open') === 'true';
    } catch {
      return false;
    }
  });

  const toggleOpen = (openState: boolean) => {
    setIsOpen(openState);
    try {
      localStorage.setItem('barangay_chatbot_open', String(openState));
    } catch {}
  };

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem('barangay_chat_messages');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((m: any) => ({
            ...m,
            timestamp: m.timestamp ? new Date(m.timestamp) : new Date()
          }));
        }
      }
    } catch {
      // ignore
    }
    return [INITIAL_WELCOME];
  });
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasNewMessage, setHasNewMessage] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Save messages to localStorage on every change
  useEffect(() => {
    if (messages && messages.length > 0) {
      try {
        localStorage.setItem('barangay_chat_messages', JSON.stringify(messages));
      } catch {
        // ignore
      }
    }
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, messages]);

  useEffect(() => {
    if (!isOpen && messages.length > 1) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg.sender === 'bot') {
        setHasNewMessage(true);
      }
    }
  }, [messages]);

  const handleSend = async (questionText?: string) => {
    const rawInput = questionText || input;
    const query = rawInput.replace(/^[📄💉🕐🏪🤰💰📝🖨️]\s*/u, '').trim();
    if (!query) return;

    if (!questionText) setInput('');
    setHasNewMessage(false);

    const userMsg: ChatMessage = { sender: 'user', text: rawInput, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const res = await apiService.askChatbot(query);
      let answer = res?.answer || res?.response;
      let topic = res?.topic;

      // If backend returned generic fallback or didn't find an answer, check client knowledge base
      if (!answer || answer.includes('could not find an answer') || (topic === 'General Inquiry' && !answer.includes('Php 50.00') && !answer.includes('Barangay Clearance Requirements'))) {
        const clientMatch = findClientAnswer(query);
        if (clientMatch) {
          answer = clientMatch.answer;
          topic = clientMatch.topic;
        }
      }

      const botMsg: ChatMessage = {
        sender: 'bot',
        text: answer || 'I am happy to help! You can ask about Barangay Clearances, free vaccine schedules, clinic hours, document fees, or resident registration.',
        topic: topic || 'General Inquiry',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, botMsg]);
    } catch (e) {
      // Offline / Network error resilience: search client knowledge base directly!
      const clientMatch = findClientAnswer(query);
      if (clientMatch) {
        setMessages(prev => [...prev, {
          sender: 'bot',
          text: clientMatch.answer,
          topic: clientMatch.topic,
          timestamp: new Date()
        }]);
      } else {
        setMessages(prev => [...prev, {
          sender: 'bot',
          text: "I'm having trouble connecting to the server right now, but you can contact the Barangay Pianing Office directly at 0917-890-1234 / (085) 341-2345, or visit the Barangay Hall from Mon–Fri, 8:00 AM – 5:00 PM.",
          topic: 'Offline Assistance',
          timestamp: new Date()
        }]);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    const freshMessages = [{
      ...INITIAL_WELCOME,
      text: 'Chat cleared! 👋 How can I help you today? Feel free to ask about barangay documents, health services, or office hours.',
      timestamp: new Date()
    }];
    setMessages(freshMessages);
    localStorage.setItem('barangay_chat_messages', JSON.stringify(freshMessages));
  };

  return (
    <>
      {/* Floating Chatbot Toggle Button */}
      <button
        onClick={() => { toggleOpen(!isOpen); setHasNewMessage(false); }}
        className="fixed bottom-5 right-5 z-40 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white p-4 rounded-full shadow-2xl flex items-center gap-2.5 cursor-pointer transition-all hover:scale-105 active:scale-95"
        aria-label="Open Barangay Assistant"
      >
        <Bot size={22} />
        <span className="text-xs font-bold hidden sm:inline">Barangay Assistant</span>
        <Sparkles size={14} className="text-amber-300 animate-pulse" />
        {hasNewMessage && (
          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-red-500 border-2 border-white animate-ping" />
        )}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-24 right-5 z-50 w-full max-w-sm sm:max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
          style={{ height: '520px' }}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-3 flex justify-between items-center shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                <Bot size={20} />
              </div>
              <div>
                <h3 className="text-sm font-bold leading-tight flex items-center gap-1.5">
                  Barangay AI Assistant
                  <Sparkles size={12} className="text-amber-300" />
                </h3>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <p className="text-[11px] text-blue-100">Online — 24/7 Support</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={scrollToBottom}
                className="p-1.5 hover:bg-white/20 rounded-lg text-blue-100 transition-colors cursor-pointer"
                title="Scroll to latest message"
              >
                <ArrowDown size={13} />
              </button>
              <button
                onClick={() => {
                  if (window.confirm('Clear the entire chat conversation? This cannot be undone.')) {
                    handleClear();
                  }
                }}
                className="p-1.5 hover:bg-red-500/30 rounded-lg text-blue-100 transition-colors cursor-pointer"
                title="Clear chat history"
              >
                <Trash2 size={13} />
              </button>
              <button
                onClick={() => toggleOpen(false)}
                className="p-1.5 hover:bg-white/20 rounded-lg text-white transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-slate-50 dark:bg-slate-950 text-xs scroll-smooth">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                {msg.topic && msg.sender === 'bot' && msg.topic !== 'Welcome' && (
                  <Badge className="mb-1 text-[9px] px-1.5 py-0 h-4 bg-indigo-100 text-indigo-700 border-indigo-200 font-semibold">
                    {msg.topic}
                  </Badge>
                )}
                <div className={`p-3 rounded-2xl max-w-[88%] leading-relaxed text-[12px] ${
                  msg.sender === 'user'
                    ? 'bg-blue-600 text-white rounded-tr-none shadow-sm'
                    : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-tl-none shadow-sm'
                }`}>
                  {msg.sender === 'bot' ? formatBotText(msg.text) : msg.text}
                </div>
                <span className="text-[9px] text-slate-400 mt-0.5 px-1">
                  {msg.timestamp?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
            {loading && (
              <div className="flex items-start">
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl rounded-tl-none p-3 shadow-sm">
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Question Pills */}
          <div className="p-2 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 overflow-x-auto shrink-0">
            <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5 px-1">Quick Questions</p>
            <div className="flex gap-1.5 pb-1 min-w-max">
              {QUICK_QUESTIONS.map((q, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(q)}
                  disabled={loading}
                  className="text-[10px] bg-slate-50 dark:bg-slate-800 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-slate-600 px-2.5 py-1 rounded-full hover:bg-blue-50 hover:border-blue-300 transition-colors whitespace-nowrap disabled:opacity-50"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* Input */}
          <form
            onSubmit={(e) => { e.preventDefault(); handleSend(); }}
            className="p-2.5 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex gap-2 shrink-0"
          >
            <Input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ask about clearances, health, or hours..."
              className="text-xs h-9 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
              disabled={loading}
            />
            <Button
              type="submit"
              size="sm"
              disabled={loading || !input.trim()}
              className="h-9 px-3 bg-blue-600 hover:bg-blue-700 text-white shrink-0 disabled:opacity-50"
            >
              <Send size={14} />
            </Button>
          </form>
        </div>
      )}
    </>
  );
}
