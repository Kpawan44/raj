import React, { useState } from 'react';
import { 
  BookOpen, 
  Printer, 
  Search, 
  Compass, 
  UserCheck, 
  Cpu, 
  HelpCircle, 
  ChevronRight, 
  Database, 
  QrCode, 
  FileSpreadsheet, 
  Layers, 
  Brain, 
  Activity, 
  Users, 
  CheckCircle, 
  FileText,
  Clock,
  ArrowRight
} from 'lucide-react';
import { UserProfile } from '../types';

interface UserGuideProps {
  currentUser: UserProfile;
}

export default function UserGuide({ currentUser }: UserGuideProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSection, setSelectedSection] = useState<'all' | 'overview' | 'roles' | 'features' | 'admin'>('all');
  const [expandedSection, setExpandedSection] = useState<string | null>('get-started');

  // Interactive Checklist for testing the app
  const [testProgress, setTestProgress] = useState<{ [key: string]: boolean }>({
    'switch-user': false,
    'create-card': false,
    'scan-qr': false,
    'transfer-dept': false,
    'view-timeline': false,
    'run-forecast': false,
    'export-sheets': false,
    'check-backup': false,
  });

  const toggleChecklist = (key: string) => {
    setTestProgress(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handlePrint = () => {
    window.print();
  };

  const sections = [
    {
      id: 'get-started',
      category: 'overview',
      title: '1. Production Ledger System Overview',
      subtitle: 'Real-Time Manufacturing Operations & Cloud Ledger Sync',
      icon: Compass,
      content: (
        <div className="space-y-4 font-sans text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
          <p>
            Welcome to the <strong>Enterprise Manufacturing Operations Ledger</strong>. This high-integrity platform is designed to track <strong>Job Cards (Work Orders)</strong>, record material transitions across production departments, analyze bottlenecks in real-time, and ensure high data reliability with multi-tier storage mechanisms.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-3 print:grid-cols-2">
            <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-150 dark:border-slate-850">
              <h5 className="font-bold text-xs text-slate-800 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1.5 mb-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                Durable Cloud Persistence
              </h5>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                All records, audits, and transactions sync securely to your dedicated Google Firestore Cloud database. Live sync badges in the sidebar indicate connected status.
              </p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-150 dark:border-slate-850">
              <h5 className="font-bold text-xs text-slate-800 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1.5 mb-2">
                <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                Offline Failover Protocol
              </h5>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                If the factory network drops, the application automatically enters Offline Mode, caching all pending transactions locally. It syncs them instantly back to the cloud upon connection recovery.
              </p>
            </div>
          </div>
          <div className="border-l-4 border-amber-500 bg-amber-500/5 p-4 rounded-r-xl">
            <h5 className="font-bold text-xs text-amber-800 dark:text-amber-400 uppercase tracking-wide">Key Manufacturing Concepts</h5>
            <ul className="list-disc pl-5 mt-2 space-y-1 text-xs text-slate-600 dark:text-slate-400">
              <li><strong>Job Card (JC):</strong> A physical/digital work order tracking a part batch as it travels through manufacturing.</li>
              <li><strong>Department (Dept):</strong> A production workshop unit (e.g., Plating, Heat Treatment, Packing).</li>
              <li><strong>Operator PIN:</strong> A unique 4-digit code required to authorize transitions and log actions.</li>
              <li><strong>Material Movement:</strong> A permanent digital record auditing the custody shift of parts.</li>
            </ul>
          </div>
        </div>
      )
    },
    {
      id: 'roles-workflows',
      category: 'roles',
      title: '2. User Personas & Department Roles',
      subtitle: 'Defining Clear Operational Authority',
      icon: UserCheck,
      content: (
        <div className="space-y-4 text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
          <p>
            Operational safety and audit accuracy are achieved by segregating duties across different user roles. Use the <strong>"Simulate Persona"</strong> switcher in the sidebar to toggle between different departments and experience their exact views.
          </p>

          <div className="space-y-3">
            <div className="border border-slate-100 dark:border-slate-800 rounded-xl overflow-hidden">
              <div className="bg-blue-50/60 dark:bg-blue-950/20 px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                <span className="font-bold text-xs text-blue-800 dark:text-blue-400 uppercase tracking-wide">Floor Operator View</span>
                <span className="text-[10px] bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full font-bold">ReadOnly/Actions</span>
              </div>
              <div className="p-4 space-y-2">
                <p className="text-xs">
                  Floor staff are assigned to a single production department (e.g., <strong>Heat Treatment</strong>, <strong>Plating</strong>). Their primary workflow is:
                </p>
                <div className="flex flex-col gap-1.5 pl-3 border-l-2 border-blue-400 text-xs text-slate-500 dark:text-slate-400">
                  <p>1. Open the <strong>Department Panel</strong> to see cards currently queueing or active in their workshop.</p>
                  <p>2. Scan the QR code or click details to read work order descriptions and technical specifications.</p>
                  <p>3. Process the materials, then trigger <strong>Transfer</strong> to dispatch to the next sequence department.</p>
                  <p>4. Input their private <strong>4-digit PIN</strong> to legally sign off on the custody handoff.</p>
                </div>
              </div>
            </div>

            <div className="border border-slate-100 dark:border-slate-800 rounded-xl overflow-hidden">
              <div className="bg-emerald-50/60 dark:bg-emerald-950/20 px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                <span className="font-bold text-xs text-emerald-800 dark:text-emerald-400 uppercase tracking-wide">Department Supervisor</span>
                <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full font-bold">Operational Supervisor</span>
              </div>
              <div className="p-4 space-y-2">
                <p className="text-xs">
                  Supervisors monitor active floor balances, reassign priorities, review department cycle times, and resolve operational holdups.
                </p>
                <div className="flex flex-col gap-1.5 pl-3 border-l-2 border-emerald-400 text-xs text-slate-500 dark:text-slate-400">
                  <p>• Override incorrect material weights or piece counts prior to sealing transfers.</p>
                  <p>• Create new Job Cards if material first enters from Store or Supplier.</p>
                  <p>• Perform bulk transfers and print bulk physical material checklists for multi-part batches.</p>
                </div>
              </div>
            </div>

            <div className="border border-slate-100 dark:border-slate-800 rounded-xl overflow-hidden">
              <div className="bg-rose-50/60 dark:bg-rose-950/20 px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                <span className="font-bold text-xs text-rose-800 dark:text-rose-400 uppercase tracking-wide">Enterprise Admin / Plant Manager</span>
                <span className="text-[10px] bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 px-2 py-0.5 rounded-full font-bold">Full Root Privileges</span>
              </div>
              <div className="p-4 space-y-2">
                <p className="text-xs">
                  Managers govern master settings. Their view unlocks the <strong>User & Plant Manager Console</strong> with executive powers:
                </p>
                <div className="flex flex-col gap-1.5 pl-3 border-l-2 border-rose-400 text-xs text-slate-500 dark:text-slate-400">
                  <p>• Define default manufacturing departments, cycle target metrics, and custom company logos/names.</p>
                  <p>• Manage operator user profiles, reset secure PIN codes, and alter department assignments.</p>
                  <p>• Oversee full <strong>Enterprise Audit Logs</strong> to inspect timestamps and actor details of every movement.</p>
                  <p>• Administer browser/cloud backups, restore previous databases, and execute secure Factory Resets.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'core-modules',
      category: 'features',
      title: '3. Core Operational Modules',
      subtitle: 'A Tour of the Manufacturing Suite',
      icon: Cpu,
      content: (
        <div className="space-y-5 text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
          <p>
            The system comprises five high-precision core dashboards, each designed to optimize floor throughput and enhance visibility.
          </p>

          <div className="space-y-4">
            <div className="flex gap-3.5">
              <div className="h-8 w-8 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0">
                <QrCode className="h-4 w-4 text-indigo-500" />
              </div>
              <div className="space-y-1">
                <h5 className="font-bold text-xs text-slate-800 dark:text-slate-200">Department Panel & QR Handoffs</h5>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Operate in your current workspace, create new job cards with specific priorities, and print individual <strong>high-fidelity QR codes</strong>. Use the integrated <strong>camera scanner tool</strong> (or manual barcode entry) to instantly pull up job details on any mobile device on the production floor.
                </p>
              </div>
            </div>

            <div className="flex gap-3.5">
              <div className="h-8 w-8 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0">
                <Activity className="h-4 w-4 text-cyan-500" />
              </div>
              <div className="space-y-1">
                <h5 className="font-bold text-xs text-slate-800 dark:text-slate-200">Real-Time Tracking & Live Timelines</h5>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  A visual flow stream illustrating exactly where every part batch is positioned. Track sequence paths, see color-coded status states (e.g., <strong>Transit, Work In Progress, Hold, Dispatched</strong>), and read a minute-by-minute activity ticker detailing operator movements.
                </p>
              </div>
            </div>

            <div className="flex gap-3.5">
              <div className="h-8 w-8 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0">
                <Brain className="h-4 w-4 text-pink-500" />
              </div>
              <div className="space-y-1">
                <h5 className="font-bold text-xs text-slate-800 dark:text-slate-200">AI Production Forecasts (Gemini-Powered)</h5>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Leverages the <strong>Gemini API</strong> to analyze historic department times, material weights, and operator shifts. It outputs an intelligent, data-driven prediction of expected delivery dates, flags work orders that are at risk of missing deadlines, and highlights current factory bottlenecks.
                </p>
              </div>
            </div>

            <div className="flex gap-3.5">
              <div className="h-8 w-8 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0">
                <Layers className="h-4 w-4 text-emerald-500" />
              </div>
              <div className="space-y-1">
                <h5 className="font-bold text-xs text-slate-800 dark:text-slate-200">Reports, Analytics, & CSV Export</h5>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Generate instant executive dashboards calculating <strong>Lead Times</strong>, <strong>Material Loss Ratios</strong>, and <strong>Department Cycle Efficiency</strong>. Export all data tables cleanly as highly-compatible CSV files with a single click.
                </p>
              </div>
            </div>

            <div className="flex gap-3.5">
              <div className="h-8 w-8 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0">
                <FileSpreadsheet className="h-4 w-4 text-teal-500" />
              </div>
              <div className="space-y-1">
                <h5 className="font-bold text-xs text-slate-800 dark:text-slate-200">Corporate Google Sheets Integration</h5>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Link your actual company Google Drive. Connect a specific Spreadsheet ID to sync all ledger activities directly into a clean corporate workbook. Includes interactive full-screen spreadsheet viewer embedded right in your console.
                </p>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'admin-recovery',
      category: 'admin',
      title: '4. System Recovery & Disaster Operations',
      subtitle: 'Ensuring 100% Production Continuity',
      icon: Database,
      content: (
        <div className="space-y-4 text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
          <p>
            This application includes enterprise-grade disaster resilience frameworks, managed within the <strong>User & Plant Manager Console</strong> (accessible only to Administrator accounts).
          </p>

          <div className="space-y-3.5">
            <div className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0"></div>
              <div>
                <h6 className="font-bold text-xs text-slate-800 dark:text-slate-200">Daily Automated Backups</h6>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  The system tracks the last backup timestamp locally. Upon the first login of a new calendar day, the app automatically compiles all database collections, writes a compressed JSON dump, and stores it in the browser's persistent storage.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0"></div>
              <div>
                <h6 className="font-bold text-xs text-slate-800 dark:text-slate-200">Manual Snapshots & Downloads</h6>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Administrators can trigger manual backups at any time before major system changes. These backups can be downloaded directly as physical `.json` files to a secure local drive.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0"></div>
              <div>
                <h6 className="font-bold text-xs text-slate-800 dark:text-slate-200">Point-in-Time Database Restoration</h6>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  To roll back from human errors, click the **Restore** button on any snapshot. The database will safely purge current collections, rewrite all nodes to the backup state, and log a permanent <code>RESTORE_DATABASE</code> event to the audit ledger.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 shrink-0"></div>
              <div>
                <h6 className="font-bold text-xs text-red-650 dark:text-rose-400">Emergency Factory Reset</h6>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Should database nodes become corrupt or during custom environment migrations, the **Emergency Factory Reset** purges all collections, disconnects external integrations, and automatically re-seeds pristine initial datasets, ensuring the app remains bootable.
                </p>
              </div>
            </div>
          </div>
        </div>
      )
    }
  ];

  const filteredSections = sections.filter(sec => {
    const matchesCategory = selectedSection === 'all' || sec.category === selectedSection;
    const matchesSearch = searchTerm === '' || 
      sec.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sec.subtitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sec.id.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-4 sm:p-6 print:p-0" id="user_guide_section">
      
      {/* Top Banner with Print PDF Call to Action */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm print:shadow-none print:border-none print:p-0">
        <div className="space-y-1">
          <h2 className="font-sans font-extrabold text-xl text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-indigo-500 print:hidden" />
            Interactive Enterprise User Guide
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            A comprehensive operational manual, simulation checklist, and official PDF-ready guide.
          </p>
        </div>

        <button
          type="button"
          onClick={handlePrint}
          className="w-full sm:w-auto flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-sans font-bold text-xs py-2.5 px-4 rounded-xl shadow-sm transition cursor-pointer print:hidden"
          id="btn_print_pdf_manual"
        >
          <Printer className="h-3.5 w-3.5" />
          Export to Corporate PDF
        </button>
      </div>

      {/* SEARCH AND FILTERS (Hidden during PDF print) */}
      <div className="flex flex-col md:flex-row gap-3 items-center justify-between print:hidden">
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-950 p-1.5 rounded-xl border border-slate-200/50 dark:border-slate-800/60 w-full md:w-auto overflow-x-auto">
          <button
            onClick={() => setSelectedSection('all')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              selectedSection === 'all'
                ? 'bg-white dark:bg-slate-900 text-slate-800 dark:text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-250'
            }`}
          >
            All Chapters
          </button>
          <button
            onClick={() => setSelectedSection('overview')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              selectedSection === 'overview'
                ? 'bg-white dark:bg-slate-900 text-slate-800 dark:text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-250'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setSelectedSection('roles')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              selectedSection === 'roles'
                ? 'bg-white dark:bg-slate-900 text-slate-800 dark:text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-250'
            }`}
          >
            Roles
          </button>
          <button
            onClick={() => setSelectedSection('features')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              selectedSection === 'features'
                ? 'bg-white dark:bg-slate-900 text-slate-800 dark:text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-250'
            }`}
          >
            Core Modules
          </button>
          <button
            onClick={() => setSelectedSection('admin')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              selectedSection === 'admin'
                ? 'bg-white dark:bg-slate-900 text-slate-800 dark:text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-250'
            }`}
          >
            Disaster Recovery
          </button>
        </div>

        <div className="relative w-full md:w-64 shrink-0">
          <input
            type="text"
            placeholder="Search documentation..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl py-2 px-3 pl-9 text-xs focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-100 placeholder-slate-400"
          />
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
        </div>
      </div>

      {/* QUICK TESTING CHECKLIST (Hidden during PDF print) */}
      <div className="bg-slate-50 dark:bg-slate-950/40 border border-slate-200/60 dark:border-slate-850 p-5 rounded-2xl space-y-3.5 print:hidden">
        <div className="flex justify-between items-center">
          <h4 className="font-sans font-bold text-xs text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
            <CheckCircle className="h-4 w-4 text-emerald-500" />
            Interactive Onboarding & Simulation Checklist
          </h4>
          <span className="text-[10px] font-mono font-bold bg-slate-200/50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded">
            {Object.values(testProgress).filter(Boolean).length} / {Object.keys(testProgress).length} Tasks
          </span>
        </div>
        <p className="text-xs text-slate-500 leading-normal">
          Are you evaluating this app inside the AI Studio sandbox? Follow these steps in order to experience the full operational logic of this software:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <button
            onClick={() => toggleChecklist('switch-user')}
            className={`flex items-start gap-2.5 p-3 rounded-xl border text-left transition cursor-pointer ${
              testProgress['switch-user']
                ? 'bg-emerald-500/5 border-emerald-500/30 text-slate-700 dark:text-slate-300'
                : 'bg-white dark:bg-slate-900/60 border-slate-150 dark:border-slate-850 hover:border-slate-300'
            }`}
          >
            <input 
              type="checkbox" 
              checked={testProgress['switch-user']} 
              onChange={() => {}} 
              className="mt-0.5 rounded text-emerald-500 pointer-events-none" 
            />
            <div className="space-y-0.5">
              <span className="text-[11px] font-bold block">1. Switch Operational Personas</span>
              <span className="text-[10px] text-slate-400 block leading-tight">Use sidebar bottom switcher to try Admin, Plating, or Packing operators.</span>
            </div>
          </button>

          <button
            onClick={() => toggleChecklist('create-card')}
            className={`flex items-start gap-2.5 p-3 rounded-xl border text-left transition cursor-pointer ${
              testProgress['create-card']
                ? 'bg-emerald-500/5 border-emerald-500/30 text-slate-700 dark:text-slate-300'
                : 'bg-white dark:bg-slate-900/60 border-slate-150 dark:border-slate-850 hover:border-slate-300'
            }`}
          >
            <input 
              type="checkbox" 
              checked={testProgress['create-card']} 
              onChange={() => {}} 
              className="mt-0.5 rounded text-emerald-500 pointer-events-none" 
            />
            <div className="space-y-0.5">
              <span className="text-[11px] font-bold block">2. Create a New Job Card</span>
              <span className="text-[10px] text-slate-400 block leading-tight">Go to "Department Panel", click "Create Job Card", and assign weight/urgency.</span>
            </div>
          </button>

          <button
            onClick={() => toggleChecklist('scan-qr')}
            className={`flex items-start gap-2.5 p-3 rounded-xl border text-left transition cursor-pointer ${
              testProgress['scan-qr']
                ? 'bg-emerald-500/5 border-emerald-500/30 text-slate-700 dark:text-slate-300'
                : 'bg-white dark:bg-slate-900/60 border-slate-150 dark:border-slate-850 hover:border-slate-300'
            }`}
          >
            <input 
              type="checkbox" 
              checked={testProgress['scan-qr']} 
              onChange={() => {}} 
              className="mt-0.5 rounded text-emerald-500 pointer-events-none" 
            />
            <div className="space-y-0.5">
              <span className="text-[11px] font-bold block">3. Inspect QR Handover Details</span>
              <span className="text-[10px] text-slate-400 block leading-tight">Click QR icon on a card to render high-contrast labels ready for print.</span>
            </div>
          </button>

          <button
            onClick={() => toggleChecklist('transfer-dept')}
            className={`flex items-start gap-2.5 p-3 rounded-xl border text-left transition cursor-pointer ${
              testProgress['transfer-dept']
                ? 'bg-emerald-500/5 border-emerald-500/30 text-slate-700 dark:text-slate-300'
                : 'bg-white dark:bg-slate-900/60 border-slate-150 dark:border-slate-850 hover:border-slate-300'
            }`}
          >
            <input 
              type="checkbox" 
              checked={testProgress['transfer-dept']} 
              onChange={() => {}} 
              className="mt-0.5 rounded text-emerald-500 pointer-events-none" 
            />
            <div className="space-y-0.5">
              <span className="text-[11px] font-bold block">4. Execute Material Handoff</span>
              <span className="text-[10px] text-slate-400 block leading-tight">Click "Transfer" in Department Panel, choose destination, and input Operator PIN (e.g. 1234).</span>
            </div>
          </button>

          <button
            onClick={() => toggleChecklist('view-timeline')}
            className={`flex items-start gap-2.5 p-3 rounded-xl border text-left transition cursor-pointer ${
              testProgress['view-timeline']
                ? 'bg-emerald-500/5 border-emerald-500/30 text-slate-700 dark:text-slate-300'
                : 'bg-white dark:bg-slate-900/60 border-slate-150 dark:border-slate-850 hover:border-slate-300'
            }`}
          >
            <input 
              type="checkbox" 
              checked={testProgress['view-timeline']} 
              onChange={() => {}} 
              className="mt-0.5 rounded text-emerald-500 pointer-events-none" 
            />
            <div className="space-y-0.5">
              <span className="text-[11px] font-bold block">5. Inspect Real-Time Tracking</span>
              <span className="text-[10px] text-slate-400 block leading-tight">Open "Real-Time Tracking" to view the visual sequence mapping and log history.</span>
            </div>
          </button>

          <button
            onClick={() => toggleChecklist('run-forecast')}
            className={`flex items-start gap-2.5 p-3 rounded-xl border text-left transition cursor-pointer ${
              testProgress['run-forecast']
                ? 'bg-emerald-500/5 border-emerald-500/30 text-slate-700 dark:text-slate-300'
                : 'bg-white dark:bg-slate-900/60 border-slate-150 dark:border-slate-850 hover:border-slate-300'
            }`}
          >
            <input 
              type="checkbox" 
              checked={testProgress['run-forecast']} 
              onChange={() => {}} 
              className="mt-0.5 rounded text-emerald-500 pointer-events-none" 
            />
            <div className="space-y-0.5">
              <span className="text-[11px] font-bold block">6. Consult AI Production Forecasts</span>
              <span className="text-[10px] text-slate-400 block leading-tight">Select "AI Production Forecast" to let Gemini review logs and alert you on delay risks.</span>
            </div>
          </button>

          <button
            onClick={() => toggleChecklist('export-sheets')}
            className={`flex items-start gap-2.5 p-3 rounded-xl border text-left transition cursor-pointer ${
              testProgress['export-sheets']
                ? 'bg-emerald-500/5 border-emerald-500/30 text-slate-700 dark:text-slate-300'
                : 'bg-white dark:bg-slate-900/60 border-slate-150 dark:border-slate-850 hover:border-slate-300'
            }`}
          >
            <input 
              type="checkbox" 
              checked={testProgress['export-sheets']} 
              onChange={() => {}} 
              className="mt-0.5 rounded text-emerald-500 pointer-events-none" 
            />
            <div className="space-y-0.5">
              <span className="text-[11px] font-bold block">7. Test Report Exporters</span>
              <span className="text-[10px] text-slate-400 block leading-tight">Visit "Reports & Analytics" and trigger a quick spreadsheet CSV file download.</span>
            </div>
          </button>

          <button
            onClick={() => toggleChecklist('check-backup')}
            className={`flex items-start gap-2.5 p-3 rounded-xl border text-left transition cursor-pointer ${
              testProgress['check-backup']
                ? 'bg-emerald-500/5 border-emerald-500/30 text-slate-700 dark:text-slate-300'
                : 'bg-white dark:bg-slate-900/60 border-slate-150 dark:border-slate-850 hover:border-slate-300'
            }`}
          >
            <input 
              type="checkbox" 
              checked={testProgress['check-backup']} 
              onChange={() => {}} 
              className="mt-0.5 rounded text-emerald-500 pointer-events-none" 
            />
            <div className="space-y-0.5">
              <span className="text-[11px] font-bold block">8. Trigger Disaster Backup</span>
              <span className="text-[10px] text-slate-400 block leading-tight">As an Admin, visit "User & Plant Manager" and run a manual database snapshot.</span>
            </div>
          </button>
        </div>
      </div>

      {/* DETAILED DOCUMENTATION CHAPTERS */}
      <div className="space-y-5 print:space-y-8">
        
        {/* Printable Title Header (Only visible on print) */}
        <div className="hidden print:block text-center border-b-2 border-slate-900 pb-6 mb-8">
          <h1 className="font-sans font-black text-2xl uppercase tracking-tight text-slate-900">
            Enterprise Operations Ledger Manual
          </h1>
          <p className="text-xs font-mono text-slate-500 mt-2 uppercase tracking-widest">
            OFFICIAL MANUFACTURING PROCESS DOCUMENT • VERSION 2026.4
          </p>
          <div className="grid grid-cols-3 gap-4 text-left mt-6 pt-4 border-t border-slate-200">
            <div>
              <span className="text-[9px] font-bold uppercase block text-slate-400 font-mono">Issued To</span>
              <span className="text-xs font-semibold text-slate-800">{currentUser.name}</span>
            </div>
            <div>
              <span className="text-[9px] font-bold uppercase block text-slate-400 font-mono">Department</span>
              <span className="text-xs font-semibold text-slate-800">{currentUser.department}</span>
            </div>
            <div>
              <span className="text-[9px] font-bold uppercase block text-slate-400 font-mono">Current Date</span>
              <span className="text-xs font-semibold text-slate-800">{new Date().toLocaleDateString()}</span>
            </div>
          </div>
        </div>

        {/* Chapters */}
        {filteredSections.map((sec) => {
          const Icon = sec.icon;
          const isExpanded = expandedSection === sec.id;
          return (
            <div 
              key={sec.id}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden print:border-none print:shadow-none print:p-0 print:mb-10 print:break-inside-avoid"
            >
              {/* Header block (Interactive only in UI, fixed open on print) */}
              <button
                type="button"
                onClick={() => setExpandedSection(isExpanded ? null : sec.id)}
                className="w-full flex items-center justify-between p-5 text-left border-b border-slate-150 dark:border-slate-850/60 hover:bg-slate-50/50 dark:hover:bg-slate-950/20 transition cursor-pointer print:pointer-events-none print:bg-transparent print:border-b-2 print:border-slate-850 print:p-0 print:pb-2"
              >
                <div className="flex items-center gap-3.5">
                  <div className="h-9 w-9 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200/60 dark:border-slate-850 flex items-center justify-center text-indigo-500 shrink-0 print:hidden">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-sans font-bold text-sm text-slate-900 dark:text-white uppercase tracking-wider">
                      {sec.title}
                    </h3>
                    <p className="text-xs text-slate-400 font-medium">
                      {sec.subtitle}
                    </p>
                  </div>
                </div>

                <div className="text-slate-400 print:hidden">
                  <ChevronRight className={`h-4 w-4 transform transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                </div>
              </button>

              {/* Content body */}
              {(isExpanded || expandedSection === null || selectedSection !== 'all') && (
                <div className="p-6 space-y-4 print:p-0 print:pt-4">
                  {sec.content}
                </div>
              )}
            </div>
          );
        })}

        {/* Printable Footer (Only visible on print) */}
        <div className="hidden print:flex justify-between items-center border-t border-slate-300 pt-6 mt-12 text-[10px] text-slate-400 font-mono">
          <span>Enterprise Operations Platform Sync #Site-1</span>
          <span>Approved: Technical Site Operations</span>
          <span>Page 1 of 1</span>
        </div>
      </div>
    </div>
  );
}
