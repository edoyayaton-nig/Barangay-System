import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { FileText, Users, Baby, Bell, BarChart, Shield, ArrowRight, CheckCircle2, MapPin, Clock, AlertTriangle, Wrench } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { apiService } from '../../services/api';
import SystemNoticeBanner from '../components/SystemNoticeBanner';

export default function LandingPage() {
  const navigate = useNavigate();

  const features = [
    {
      icon: FileText,
      color: 'bg-blue-100 text-blue-600',
      title: 'Document Clearance Processing',
      description: 'Request and receive Barangay Clearances, Residency Certificates, and Business Permits — quickly and conveniently.'
    },
    {
      icon: Users,
      color: 'bg-indigo-100 text-indigo-600',
      title: 'Resident Demographic Registry',
      description: 'Comprehensive resident records management for accurate information retrieval and official reporting.'
    },
    {
      icon: Baby,
      color: 'bg-teal-100 text-teal-600',
      title: 'Child Healthcare & Immunization',
      description: 'Track infant vaccinations (BCG, HepB, DPT, Polio, MMR) and receive automated reminders for scheduled immunizations.'
    },
    {
      icon: Bell,
      color: 'bg-purple-100 text-purple-600',
      title: 'SMS & Email Notifications',
      description: 'Receive timely SMS and email reminders for health appointments, document readiness, and important barangay announcements.'
    },
    {
      icon: BarChart,
      color: 'bg-amber-100 text-amber-600',
      title: 'Health & Community Reports',
      description: 'Real-time summaries of health coverage rates, registered residents, and document issuance for informed decision-making.'
    },
    {
      icon: Shield,
      color: 'bg-emerald-100 text-emerald-600',
      title: 'Secure Role-Based Access',
      description: 'Dedicated portals for Barangay Administrators, Health Workers, and Residents with complete activity audit trails.'
    }
  ];

  const highlights = [
    { icon: CheckCircle2, text: 'Online document requests — no need to fall in line' },
    { icon: CheckCircle2, text: 'Instant SMS & email notifications when documents are ready' },
    { icon: CheckCircle2, text: 'Health appointment tracking for mothers and infants' },
    { icon: CheckCircle2, text: 'Secure and private — only authorized personnel can access your records' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col font-sans">
      {/* System Notice Banner (System Down / Maintenance / Advisory) */}
      <SystemNoticeBanner
        showStaffButton={true}
        onStaffClick={() => navigate('/login?tab=login')}
      />

      {/* Top Navbar */}
      <nav className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-30 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full overflow-hidden bg-white shadow-md border border-slate-200 flex items-center justify-center">
              <img src="/assets/pianing-logo.png" alt="Barangay Pianing" className="w-full h-full object-contain" />
            </div>
            <div>
              <span className="text-base font-bold text-slate-900 dark:text-white block leading-tight">Barangay Pianing</span>
              <span className="text-xs text-slate-500 font-medium">Smart Barangay Portal — Butuan City</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => navigate('/login?tab=register')}
              className="border-slate-300 text-slate-700 hover:bg-slate-100 font-semibold text-xs h-9 px-3.5"
            >
              Sign Up
            </Button>
            <Button
              onClick={() => navigate('/login?tab=login')}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs h-9 px-4 shadow-sm"
            >
              Log In
              <ArrowRight size={14} className="ml-1" />
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-12 text-center">
        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 px-3 py-1 mb-4 text-xs font-semibold rounded-full">
          ✨ Barangay Pianing, Butuan City, Agusan del Norte
        </Badge>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-4 max-w-4xl mx-auto leading-tight">
          Smart Digital Services for <span className="text-blue-600">Barangay Pianing</span> Residents
        </h1>
        <p className="text-lg text-slate-600 dark:text-slate-400 max-w-3xl mx-auto mb-8 leading-relaxed">
          A modern online portal connecting residents with fast, convenient access to barangay clearances, health services, and community announcements — anytime, anywhere.
        </p>

        <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500 mt-2">
          <MapPin size={14} className="text-blue-600" />
          <span className="font-medium">Barangay Pianing, Butuan City, Agusan del Norte</span>
        </div>
      </section>

      {/* Highlights Strip */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-10">
        <div className="grid sm:grid-cols-2 gap-3">
          {highlights.map((item, i) => (
            <div key={i} className="flex items-start gap-2.5 bg-white border border-slate-100 rounded-xl px-4 py-3 shadow-xs">
              <item.icon size={16} className="text-emerald-500 shrink-0 mt-0.5" />
              <span className="text-xs text-slate-700 leading-relaxed">{item.text}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Features Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-10">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">What You Can Do Here</h2>
          <p className="text-xs text-slate-500 mt-1">Services available to Barangay Pianing residents, health workers, and administrators.</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <Card key={index} className="border-slate-200 bg-white hover:shadow-md transition-all duration-200">
              <CardHeader className="pb-2">
                <div className={`w-12 h-12 rounded-xl ${feature.color} flex items-center justify-center mb-3 shadow-xs`}>
                  <feature.icon size={24} />
                </div>
                <CardTitle className="text-base font-bold text-slate-900">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-xs text-slate-500 leading-relaxed">
                  {feature.description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Office Hours & Community Information Banner */}
      <section className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 my-8">
        <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-2xl p-8 sm:p-10 shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-center md:text-left">
            <Badge className="bg-blue-500 text-white text-[11px]">Official Barangay Portal</Badge>
            <h3 className="text-2xl font-bold">Barangay Pianing Hall & Health Center</h3>
            <p className="text-xs text-slate-300 max-w-xl leading-relaxed">
              Serving the community with streamlined document processing, maternal and child healthcare, and transparent local governance.
            </p>
          </div>
          <div className="flex flex-col gap-2 text-xs text-slate-200 bg-white/10 p-4 rounded-xl backdrop-blur-sm border border-white/10 shrink-0">
            <div className="flex items-center gap-2 font-semibold text-white">
              <Clock size={15} className="text-blue-400" />
              <span>Office &amp; Health Center Hours</span>
            </div>
            <p className="text-slate-300 text-[11px]">Monday to Friday: 8:00 AM – 5:00 PM</p>
            <p className="text-slate-400 text-[10px]">Emergency Hotline: Contact Barangay Peacekeeping Officers</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto bg-slate-900 text-slate-400 py-8 border-t border-slate-800 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center gap-4 text-center sm:text-left">
          <div>
            <p className="font-semibold text-slate-300">Barangay Pianing — Smart Governance Portal</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Office of the Punong Barangay · Hon. Virgenia S. Golandrina · Butuan City, Agusan del Norte</p>
          </div>
          <div className="flex items-center gap-2">
            <MapPin size={13} className="text-blue-400" />
            <span className="text-[11px]">Barangay Pianing, Butuan City</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
