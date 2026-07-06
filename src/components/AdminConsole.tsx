import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Settings, 
  FileText, 
  Trash2, 
  UserPlus, 
  ShieldAlert, 
  ToggleLeft, 
  Activity, 
  Check, 
  Sliders,
  Search,
  Warehouse,
  Database,
  Package,
  Building2,
  FileSpreadsheet,
  ExternalLink
} from 'lucide-react';
import { UserProfile, AuditLog, Department, JobCard, MaterialMovement, CompanyConfig } from '../types';
import { getJobCardProcessMetrics } from '../lib/metrics';
import { DBService } from '../lib/firebase';

interface AdminConsoleProps {
  users: UserProfile[];
  auditLogs: AuditLog[];
  onSaveUser: (user: UserProfile) => void;
  onLogAction: (action: string, details: string) => void;
  currentUser: UserProfile | null;
  onDeleteUser: (userId: string, userName: string) => void;
  jobCards?: JobCard[];
  movements?: MaterialMovement[];
  onRefreshJobs?: () => void;
  companyConfig?: CompanyConfig | null;
  onRefreshCompany?: () => void;
  isSheetsActive?: boolean;
  sheetsDetails?: { name: string; url: string; spreadsheetId: string };
  onOpenSheetsModal?: () => void;
  onDisconnectSheets?: () => void;
  onOpenSheetsInspector?: () => void;
}

export default function AdminConsole({ 
  users, 
  auditLogs, 
  onSaveUser, 
  onLogAction, 
  currentUser, 
  onDeleteUser,
  jobCards = [],
  movements = [],
  onRefreshJobs,
  companyConfig = null,
  onRefreshCompany,
  isSheetsActive = false,
  sheetsDetails,
  onOpenSheetsModal,
  onDisconnectSheets,
  onOpenSheetsInspector
}: AdminConsoleProps) {
  const [activeSubTab, setActiveSubTab] = useState<'users' | 'settings' | 'audit' | 'jobs' | 'stock' | 'company'>('users');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Create New User Forms State
  const [showAddForm, setShowAddForm] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserPin, setNewUserPin] = useState('');
  const [newUserDept, setNewUserDept] = useState<Department | 'Admin'>('Production');
  const [newUserRole, setNewUserRole] = useState<'staff' | 'admin'>('staff');
  const [pinError, setPinError] = useState('');

  // Delete User State
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmDeleteName, setConfirmDeleteName] = useState<string>('');

  const isManager = currentUser?.role === 'admin';

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    setPinError('');
    if (!isManager) {
      setPinError('Unauthorized: Only a Manager is authorized to add staff.');
      return;
    }

    if (!newUserName) return;

    // Auto-generate a secure 4-digit PIN under the hood for backend compatibility
    const generatedPin = Math.floor(1000 + Math.random() * 9000).toString();

    const newProfile: UserProfile = {
      userId: `u-${Math.floor(Math.random() * 9000) + 1000}`,
      name: newUserName,
      email: `${newUserName.toLowerCase().replace(/\s+/g, '')}@factory.com`,
      pin: generatedPin,
      department: newUserDept,
      role: newUserRole,
      active: true,
      createdAt: new Date().toISOString()
    };

    onSaveUser(newProfile);
    onLogAction('CREATE_USER', `Created new user account '${newProfile.name}' for department ${newProfile.department} with role ${newUserRole}`);
    
    // Reset Form
    setNewUserName('');
    setNewUserPin('');
    setShowAddForm(false);
  };

  const toggleUserActive = (user: UserProfile) => {
    if (!isManager) {
      alert('Only plant managers are authorized to modify operator profiles.');
      return;
    }
    const updated = { ...user, active: !user.active };
    onSaveUser(updated);
    onLogAction('TOGGLE_USER_STATUS', `Changed activation status of '${user.name}' to ${updated.active ? 'ACTIVE' : 'INACTIVE'}`);
  };

  // Filtered lists
  const filteredUsers = users.filter(u => {
    return (
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.pin && u.pin.includes(searchTerm)) ||
      (u.email && u.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      u.department.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const filteredLogs = auditLogs.filter(l => {
    return (
      l.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.action.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  return (
    <div className="space-y-6">
      
      {/* Google Sheets Syncer Status and Direct Link for Admin */}
      {isSheetsActive && sheetsDetails?.url ? (
        <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50 rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 animate-fade-in shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100">Live Google Sheets Sync Active</h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Connected logbook: <span className="font-semibold text-slate-700 dark:text-slate-200">{sheetsDetails.name || "Factory Material Flow Ledger"}</span>
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {onOpenSheetsInspector && (
              <button
                onClick={onOpenSheetsInspector}
                className="flex-1 sm:flex-initial text-center bg-emerald-600 hover:bg-emerald-500 text-white font-sans font-bold text-xs py-2 px-4 rounded-lg flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
                title="View actual spreadsheet columns and rows in-app"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                <span>Inspect Live Sheet</span>
              </button>
            )}
            <a
              href={sheetsDetails.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 sm:flex-initial text-center bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 font-sans font-bold text-xs py-2 px-4 rounded-lg flex items-center justify-center gap-1.5 shadow-sm transition-all"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span>Open Google Sheet</span>
            </a>
            {onDisconnectSheets && (
              <button
                onClick={onDisconnectSheets}
                className="text-xs bg-red-50 hover:bg-red-100 dark:bg-red-950/20 text-red-600 dark:text-red-400 py-2 px-3 rounded-lg font-semibold transition"
                title="Disconnect from Google Sheets"
              >
                Disconnect
              </button>
            )}
          </div>
        </div>
      ) : (
        onOpenSheetsModal && (
          <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 shrink-0">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-750 dark:text-slate-350">Google Sheets Logbook Offline</h4>
                <p className="text-[11px] text-slate-400">Link your Google Sheets account to sync all production transactions, material movements, and rejections.</p>
              </div>
            </div>
            <button
              onClick={onOpenSheetsModal}
              className="w-full sm:w-auto bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs py-2 px-4 rounded-lg transition"
            >
              Link Google Sheets
            </button>
          </div>
        )
      )}

      {/* Sub tabs header */}
      <div className="flex border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => { setActiveSubTab('users'); setSearchTerm(''); }}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-all ${
            activeSubTab === 'users'
              ? 'border-[#3B82F6] text-[#3B82F6] font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Users className="h-4 w-4" />
          User Management
        </button>
        <button
          onClick={() => { setActiveSubTab('audit'); setSearchTerm(''); }}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-all ${
            activeSubTab === 'audit'
              ? 'border-[#3B82F6] text-[#3B82F6] font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <FileText className="h-4 w-4" />
          Enterprise Audit Logs
        </button>
        <button
          onClick={() => { setActiveSubTab('settings'); setSearchTerm(''); }}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-[#E2E8F0] dark:border-slate-800 border-b-2 transition-all ${
            activeSubTab === 'settings'
              ? 'border-[#3B82F6] text-[#3B82F6] font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Settings className="h-4 w-4" />
          Plant Configurations
        </button>
        <button
          onClick={() => { setActiveSubTab('jobs'); setSearchTerm(''); }}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-[#E2E8F0] dark:border-slate-800 border-b-2 transition-all ${
            activeSubTab === 'jobs'
              ? 'border-[#3B82F6] text-[#3B82F6] font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Database className="h-4 w-4 text-rose-500" />
          Job Cards Admin Database
        </button>
        <button
          onClick={() => { setActiveSubTab('stock'); setSearchTerm(''); }}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-[#E2E8F0] dark:border-slate-800 border-b-2 transition-all ${
            activeSubTab === 'stock'
              ? 'border-[#3B82F6] text-[#3B82F6] font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Package className="h-4 w-4 text-emerald-500" />
          Store Stock Sheet
        </button>
        <button
          onClick={() => { setActiveSubTab('company'); setSearchTerm(''); }}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-[#E2E8F0] dark:border-slate-800 border-b-2 transition-all ${
            activeSubTab === 'company'
              ? 'border-[#3B82F6] text-[#3B82F6] font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Building2 className="h-4 w-4 text-amber-500" />
          Company Profile
        </button>
      </div>

      {/* SEARCH AND CONTROL ACTION ROW */}
      {activeSubTab !== 'settings' && activeSubTab !== 'company' && (
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-slate-50 dark:bg-slate-900/40 p-4 rounded-xl border border-slate-200/60 dark:border-slate-800">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder={
                activeSubTab === 'users' 
                  ? "Search users by name, email..." 
                  : activeSubTab === 'jobs'
                  ? "Search job cards by party, number or item..."
                  : activeSubTab === 'stock'
                  ? "Search stock items by code or description..."
                  : "Search audit transactions..."
              }
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-white dark:bg-slate-850 pl-9 pr-3 py-2 text-xs text-slate-700 dark:text-slate-200 rounded-lg border border-slate-200 dark:border-slate-750 w-full focus:outline-none focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6]/25"
            />
          </div>

          {activeSubTab === 'users' && isManager && (
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="flex items-center gap-1.5 bg-[#3B82F6] text-white hover:bg-blue-600 font-sans font-bold text-xs py-2 px-4 rounded-lg shadow-sm transition-all border border-[#1D4ED8] cursor-pointer"
            >
              <UserPlus className="h-4 w-4" />
              Add User Profile
            </button>
          )}

          {activeSubTab === 'jobs' && isManager && (
            <button
              type="button"
              onClick={async () => {
                if (window.confirm("CRITICAL WARNING: Are you sure you want to PERMANENTLY ERASE all active and completed job cards? This will wipe the factory operations ledger clean! This step is completely irreversible.")) {
                  if (window.confirm("FINAL WARNING: Verify your plant credentials. Type 'purge all' in the next modal to proceed with this destructive action.")) {
                    const typed = window.prompt("Type 'DELETE ALL' to confirm:");
                    if (typed === 'DELETE ALL') {
                      try {
                        await DBService.deleteAllJobCards(currentUser?.userId || 'u-1', currentUser?.name || 'Pawan Kumar');
                        alert("Database wiped successfully. Wrote purge event to Enterprise Audit Logs.");
                        if (onRefreshJobs) onRefreshJobs();
                      } catch (err) {
                        console.error("Purge command failed", err);
                      }
                    } else {
                      alert("Wipe aborted: Invalid confirmation phrase.");
                    }
                  }
                }
              }}
              className="flex items-center gap-1.5 bg-red-650 hover:bg-red-550 text-white font-sans font-bold text-xs py-2 px-4 rounded-lg shadow-sm transition-all border border-red-750 cursor-pointer"
            >
              <Trash2 className="h-4 w-4" />
              Purge All Job Cards
            </button>
          )}
        </div>
      )}

      {activeSubTab === 'users' && !isManager && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-805 text-xs flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0" />
          <span>Restricted Access: Only managerial level accounts are authorized to create or modify operator profiles.</span>
        </div>
      )}

      {/* SHOW ADD USER FORM PANEL */}
      {showAddForm && activeSubTab === 'users' && isManager && (
        <form onSubmit={handleCreateUser} className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4 max-w-xl transition-all">
          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 font-sans uppercase">
            Create Simulated User profile
          </h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="col-span-1 md:col-span-2">
              <label className="block text-slate-400 font-medium mb-1">Full Name</label>
              <input
                type="text"
                placeholder="Pawan Kumar"
                required
                value={newUserName}
                onChange={e => setNewUserName(e.target.value)}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6]/25"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-medium mb-1">Assign Line / Department</label>
              <select
                value={newUserDept}
                onChange={e => setNewUserDept(e.target.value as Department | 'Admin')}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-800 dark:text-slate-100 focus:outline-none"
              >
                <option value="Admin">Admin Console</option>
                <option value="Dispatch">Dispatch Line</option>
                <option value="Production">Production Milling</option>
                <option value="Heat Treatment">Heat Treatment Line</option>
                <option value="Plating">Surface Plating</option>
                <option value="Packing">Packing Line</option>
                <option value="Store">Storehouse</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-400 font-medium mb-1">Access Level Role</label>
              <select
                value={newUserRole}
                onChange={e => setNewUserRole(e.target.value as 'staff' | 'admin')}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-800 dark:text-slate-100 focus:outline-none"
              >
                <option value="staff">Staff Operator (Privilege Tier 2)</option>
                <option value="admin">Admin Overseer (Privilege Tier 1)</option>
              </select>
            </div>
          </div>

          {pinError && (
            <div className="text-red-600 text-xs font-bold leading-none animate-bounce">
              ⚠️ {pinError}
            </div>
          )}

          <div className="flex gap-2 justify-end text-xs font-bold pt-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-4 py-2 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bg-[#3B82F6] text-white hover:bg-blue-600 border border-[#1D4ED8] px-4 py-2 rounded-lg transition shadow-sm cursor-pointer"
            >
              Save Profile
            </button>
          </div>
        </form>
      )}

      {/* RENDER ACTIVE TAB VIEWPORT */}
      {activeSubTab === 'users' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-950 text-[10px] text-slate-400 uppercase tracking-wider font-mono border-b border-slate-200 dark:border-slate-800">
                  <th className="py-3 px-4">Operator Name</th>
                  <th className="py-3 px-4">Operator Authorization PIN</th>
                  <th className="py-3 px-4">Allocated Line</th>
                  <th className="py-3 px-4">Access Level</th>
                  <th className="py-3 px-4">Operator State</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map(u => (
                  <tr key={u.userId} className="border-b last:border-b-0 border-slate-200 dark:border-slate-850 text-xs text-slate-700 dark:text-slate-350 hover:bg-slate-50/50 dark:hover:bg-slate-850/20">
                    <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                      <div className="h-6 w-6 rounded-full bg-[#EFF6FF] flex items-center justify-center font-bold text-[#3B82F6] uppercase text-[10px]">
                        {u.name.charAt(0)}
                      </div>
                      {u.name}
                    </td>
                    <td className="py-3.5 px-4 font-mono">
                      <span className="font-bold tracking-widest text-slate-800 dark:text-[#E2E8F0]">{u.pin || '—'}</span>
                      <span className="block text-[10px] text-slate-450 font-sans tracking-normal font-normal">{u.email}</span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 font-sans">{u.department}</td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                        u.role === 'admin' ? 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        u.active ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-400' : 'bg-rose-100 text-rose-800 dark:bg-rose-950/20 dark:text-rose-400'
                      }`}>
                        {u.active ? 'Active on Floor' : 'Off-duty'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => toggleUserActive(u)}
                          className={`text-[10px] font-bold px-2.5 py-1 rounded transition-colors ${
                            u.active 
                              ? 'bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/20' 
                              : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-600 dark:bg-emerald-950/20'
                          }`}
                        >
                          {u.active ? 'Disable' : 'Enable'}
                        </button>
                        {isManager && u.userId !== currentUser?.userId && (
                          <button
                            onClick={() => {
                              setConfirmDeleteId(u.userId);
                              setConfirmDeleteName(u.name);
                            }}
                            className="text-[10px] font-bold px-2 py-1 rounded bg-red-50 hover:bg-red-150 text-red-600 dark:bg-red-950/20 dark:text-red-400 flex items-center gap-1 transition-colors cursor-pointer"
                            title="Remove User Permanently"
                          >
                            <Trash2 className="h-3 w-3 text-red-500" />
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* RENDER AUDIT LOG VIEWPORT */}
      {activeSubTab === 'audit' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-950 text-[10px] text-slate-400 uppercase tracking-wider font-mono border-b border-slate-200 dark:border-slate-800">
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Action Event</th>
                  <th className="py-3 px-4">Audit Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                {filteredLogs.map(l => (
                  <tr key={l.id} className="text-xs hover:bg-slate-50/50 dark:hover:bg-slate-850/25">
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-400 shrink-0">
                      {new Date(l.timestamp).toLocaleDateString([], {month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit', second:'2-digit'})}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-800 dark:text-slate-100">{l.userName}</td>
                    <td className="py-3 px-4">
                      <span className="font-mono text-[10px] bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded font-bold">
                        {l.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-500 dark:text-slate-400 font-sans max-w-sm truncate">{l.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* RENDER SETTINGS PANEL */}
      {activeSubTab === 'settings' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4 shadow-sm">
            <h4 className="font-sans font-bold text-sm text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Warehouse className="h-5 w-5 text-[#3B82F6]" />
              Multi-Plant System Setup
            </h4>
            
            <p className="text-xs text-slate-500 leading-normal">
              Toggle allocations across separate production campuses. Setting coordinates synchronizes ledger books across multiple physical sites.
            </p>

            <div className="space-y-3.5 text-xs">
              <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-850 rounded-xl border border-slate-200/50">
                <div>
                  <div className="font-semibold text-slate-800 dark:text-slate-200">Camp #1 - Standard Line</div>
                  <div className="text-[10px] text-slate-400">Main smelting and electroplating lines</div>
                </div>
                <span className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  Online
                </span>
              </div>

              <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-850 rounded-xl border border-slate-200/50">
                <div>
                  <div className="font-semibold text-slate-800 dark:text-slate-200">Camp #2 - Heat Assembly</div>
                  <div className="text-[10px] text-slate-400">Satellite hardening line located in Phase 2 block</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    Standby
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4 shadow-sm">
            <h4 className="font-sans font-bold text-sm text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Activity className="h-5 w-5 text-indigo-500" />
              Firestore Stream Sync Engine
            </h4>

            <p className="text-xs text-slate-500 leading-normal">
              When Firebase applet credentials are fully loaded, real-time sync is enabled. Adjust active websocket timeouts below:
            </p>

            <div className="space-y-4 text-xs font-mono">
              <div>
                <label className="block text-slate-400 text-[10px] uppercase font-bold mb-1">Listener Stream Timeout</label>
                <input 
                  type="number" 
                  defaultValue={30} 
                  className="bg-slate-50 dark:bg-slate-850 rounded border border-slate-200 dark:border-slate-750 p-2 text-slate-700 dark:text-slate-200 w-full"
                />
                <span className="text-[9px] text-slate-400">Minutes before websocket connection refresh</span>
              </div>
              
              <div className="p-3 bg-indigo-50/50 dark:bg-slate-850 rounded-lg flex items-start gap-2 text-[11px] text-slate-500 dark:text-slate-200">
                <ShieldAlert className="h-4 w-4 text-indigo-500 shrink-0 mt-0.5" />
                <p className="leading-tight font-sans">
                  The current build incorporates live updates using local storage custom triggers as fallback, guaranteeing immediate reactive views for development evaluation.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RENDER JOBS MANAGEMENT PANEL */}
      {activeSubTab === 'jobs' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div>
              <h4 className="font-sans font-bold text-sm text-slate-800 dark:text-slate-100 uppercase tracking-wide">
                Active & Closed Job Cards Ledger
              </h4>
              <p className="text-[11px] text-slate-400 italic">Manage, search, or administratively remove individual manufacturing runs.</p>
            </div>
            <div className="text-[10px] font-mono text-slate-500 bg-slate-100 dark:bg-slate-800 p-1.5 rounded border border-slate-200 dark:border-slate-700">
              Total Recorded Lines: <strong>{jobCards.length}</strong>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            {jobCards.filter(j => 
              j.jobCardNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
              j.partyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
              j.itemName.toLowerCase().includes(searchTerm.toLowerCase())
            ).length === 0 ? (
              <div className="text-center p-12 space-y-1.5">
                <span className="text-2xl">🔍</span>
                <p className="text-xs font-semibold text-slate-400 font-mono">No job cards match query parameters</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/75 dark:bg-slate-950/75 text-[10px] text-slate-400 uppercase tracking-widest font-mono border-b border-slate-200 dark:border-slate-800">
                    <th className="py-3 px-4">Card No</th>
                    <th className="py-3 px-4">Customer / Party Name</th>
                    <th className="py-3 px-4">Item Details</th>
                    <th className="py-3 px-4">Order Qty</th>
                    <th className="py-3 px-4">Active Station</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                  {jobCards
                    .filter(j => 
                      j.jobCardNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      j.partyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      j.itemName.toLowerCase().includes(searchTerm.toLowerCase())
                    )
                    .map(j => (
                      <tr key={j.jobCardNo} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/25">
                        <td className="py-3 px-4 font-mono font-extrabold text-indigo-500">{j.jobCardNo}</td>
                        <td className="py-3 px-4 font-semibold text-slate-800 dark:text-slate-100">{j.partyName}</td>
                        <td className="py-2 px-4 leading-normal">
                          <p className="font-medium text-slate-700 dark:text-slate-300">{j.itemName}</p>
                          <p className="text-[10px] font-mono text-slate-400">{j.itemCode}</p>
                        </td>
                        <td className="py-3 px-4 font-mono">{j.orderQty.toLocaleString()} KG</td>
                        <td className="py-3 px-4 font-medium text-slate-500">{j.currentDepartment}</td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded text-[9px] font-extrabold font-sans">
                            {j.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {isManager ? (
                            <button
                              type="button"
                              onClick={async () => {
                                if (window.confirm(`Are you sure you want to permanently delete Job Card ${j.jobCardNo}? This action is irreversible!`)) {
                                  try {
                                    await DBService.deleteJobCard(j.jobCardNo, currentUser?.userId || 'u-1', currentUser?.name || 'Pawan Kumar');
                                    alert(`Job Card ${j.jobCardNo} successfully removed.`);
                                    if (onRefreshJobs) onRefreshJobs();
                                  } catch (err: any) {
                                    console.error("Deletion failed", err);
                                    alert(`Failed to delete Job Card: ${err instanceof Error ? err.message : String(err)}`);
                                  }
                                }
                              }}
                              className="text-[11px] bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-950/20 dark:text-red-400 p-1.5 rounded font-bold transition-all inline-flex items-center gap-1 cursor-pointer"
                              title="Delete Selected Job Card"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Delete
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">Admin role required</span>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* RENDER STORE STOCK SHEET */}
      {activeSubTab === 'stock' && (
        <div className="space-y-4">
          <div className="p-5 bg-gradient-to-r from-emerald-550/10 to-teal-555/10 dark:from-slate-900 dark:to-slate-950 border border-emerald-500/10 dark:border-slate-800 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h4 className="font-sans font-bold text-base text-emerald-800 dark:text-emerald-400 flex items-center gap-2">
                <Package className="h-5 w-5" />
                Storehouse Inventory & Stock register
              </h4>
              <p className="text-xs text-slate-500 max-w-xl leading-normal mt-1">
                Compiled material ledger showcasing cumulative weights ingested through completed packaging milestones vs outgoing dispatches. Bins coordinates denote current warehouse storage locations.
              </p>
            </div>
            
            <div className="flex gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  window.print();
                }}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-sans font-bold text-xs py-2 px-3 rounded-lg flex items-center gap-1.5 shadow-sm transition cursor-pointer"
              >
                <FileText className="h-4 w-4" />
                Print Stock Ledger
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              {(() => {
                const stockMap: Record<string, {
                  itemCode: string;
                  itemName: string;
                  qtyIngested: number;
                  qtyDispatched: number;
                  qtyInStock: number;
                  bins: Set<string>;
                  lastUpdated: string;
                }> = {};

                jobCards.forEach(j => {
                  const m = getJobCardProcessMetrics(j, movements);
                  const key = j.itemCode || 'UNKNOWN';
                  
                  if (!stockMap[key]) {
                    stockMap[key] = {
                      itemCode: key,
                      itemName: j.itemName,
                      qtyIngested: 0,
                      qtyDispatched: 0,
                      qtyInStock: 0,
                      bins: new Set<string>(),
                      lastUpdated: j.createdAt
                    };
                  }
                  
                  stockMap[key].qtyIngested += m.qtyReceivedAtStore;
                  stockMap[key].qtyDispatched += m.qtyDispatched;
                  stockMap[key].qtyInStock += m.qtyRemainingInStock;
                  if (j.storeDetails?.locationBin) {
                    stockMap[key].bins.add(j.storeDetails.locationBin);
                  }
                  if (new Date(j.createdAt) > new Date(stockMap[key].lastUpdated)) {
                    stockMap[key].lastUpdated = j.createdAt;
                  }
                });

                const stockList = Object.values(stockMap).filter(s =>
                  s.itemCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  s.itemName.toLowerCase().includes(searchTerm.toLowerCase())
                );

                if (stockList.length === 0) {
                  return (
                    <div className="text-center p-12 space-y-1.5">
                      <span className="text-2xl">📦</span>
                      <p className="text-xs font-semibold text-slate-400 font-mono">No physical storehouse stock data found matching search criteria</p>
                    </div>
                  );
                }

                return (
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-950 text-[10px] text-slate-400 uppercase tracking-widest font-mono border-b border-slate-200 dark:border-slate-800">
                        <th className="py-3.5 px-4 font-mono">Item Code</th>
                        <th className="py-3.5 px-4">Product Name</th>
                        <th className="py-3.5 px-4 text-right bg-blue-500/5 dark:bg-blue-950/20 text-blue-700 dark:text-blue-350">Cum. Ingested (KG)</th>
                        <th className="py-3.5 px-4 text-right bg-pink-500/5 dark:bg-pink-950/20 text-pink-700 dark:text-pink-350">Cum. Dispatched (KG)</th>
                        <th className="py-3.5 px-4 text-right bg-emerald-500/5 dark:bg-emerald-950/25 text-emerald-700 dark:text-emerald-300 font-bold">In-Stock Balance (KG)</th>
                        <th className="py-3.5 px-4 text-center">Allocated Bins</th>
                        <th className="py-3.5 px-4 text-center">Ledger Refresh</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                      {stockList.map(s => (
                        <tr key={s.itemCode} className="hover:bg-slate-50/40 dark:hover:bg-slate-850/15">
                          <td className="py-3.5 px-3 font-mono font-bold text-[#3B82F6]">{s.itemCode}</td>
                          <td className="py-3.5 px-3 font-semibold text-slate-800 dark:text-slate-100">{s.itemName}</td>
                          <td className="py-3.5 px-3 font-mono text-right bg-blue-500/5 dark:bg-blue-950/20 text-slate-700 dark:text-slate-300 font-medium">{s.qtyIngested.toLocaleString()} KG</td>
                          <td className="py-3.5 px-3 font-mono text-right bg-pink-500/5 dark:bg-pink-950/10 text-slate-700 dark:text-slate-300 font-medium">{s.qtyDispatched.toLocaleString()} KG</td>
                          <td className="py-3.5 px-4 font-mono text-right bg-emerald-500/5 dark:bg-emerald-950/15 text-emerald-600 dark:text-emerald-400 font-bold rounded">
                            {s.qtyInStock.toLocaleString()} KG
                          </td>
                          <td className="py-3.5 px-4 text-center font-mono text-[11px]">
                            {s.bins.size > 0 ? (
                              Array.from(s.bins).map(bin => (
                                <span key={bin} className="inline-block bg-slate-100 border border-slate-200 text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 px-1.5 py-0.5 rounded text-[10px] font-bold mr-1">{bin}</span>
                              ))
                            ) : (
                              <span className="text-slate-400 italic text-[10px]">No Bin Tagged</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-center text-slate-400 text-[10px]">
                            {new Date(s.lastUpdated).toLocaleDateString([], {month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit'})}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Target delete modal overlay */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl relative space-y-4">
            <h3 className="text-base font-extrabold text-red-600 uppercase tracking-wider flex items-center gap-1.5 text-red-650 font-sans">
              <ShieldAlert className="h-5 w-5 text-red-600" />
              Confirm Personnel Deletion
            </h3>
            <p className="text-xs text-slate-500 leading-normal">
              Are you sure you want to permanently delete the profile of <strong className="text-slate-800 dark:text-slate-200">{confirmDeleteName}</strong>? This action cannot be undone, and they will lose access to the workstation immediately.
            </p>
            <div className="flex gap-2 justify-end text-xs font-bold font-sans">
              <button
                type="button"
                onClick={() => {
                  setConfirmDeleteId(null);
                  setConfirmDeleteName('');
                }}
                className="bg-slate-150 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 px-4 py-2.5 rounded-lg transition"
              >
                No, Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirmDeleteId) {
                    onDeleteUser(confirmDeleteId, confirmDeleteName);
                  }
                  setConfirmDeleteId(null);
                  setConfirmDeleteName('');
                }}
                className="bg-red-600 text-white hover:bg-red-500 border border-red-700 px-4 py-2.5 rounded-lg transition shadow-sm cursor-pointer"
              >
                Yes, Delete Permanent
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RENDER COMPANY PROFILE UPDATE PAGE */}
      {activeSubTab === 'company' && (
        <div className="space-y-6 animate-fade-in">
          <div className="p-5 bg-gradient-to-r from-amber-500/10 to-orange-500/10 dark:from-slate-900 dark:to-slate-950 border border-amber-500/15 dark:border-slate-800 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h4 className="font-sans font-bold text-base text-amber-800 dark:text-amber-400 flex items-center gap-2">
                <Building2 className="h-5 w-5 text-amber-500" />
                Active Corporate Identity & Works Profile
              </h4>
              <p className="text-xs text-slate-500 max-w-xl leading-normal mt-1">
                Customize your company name, registration metadata, and contact details. Content updated here is globally referenced for report printing, job cards databases, and general ledger headers across the enterprise nodes.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Display View Card */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 rounded-2xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50 flex flex-col items-center justify-center">
                    <span className="text-2xl font-extrabold tracking-tight font-mono">
                      {companyConfig?.companyName ? companyConfig.companyName.substring(0, 2).toUpperCase() : 'PM'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold font-mono text-amber-500 uppercase tracking-widest bg-amber-500/10 px-2 py-0.5 rounded">
                      Enterprise Hub
                    </span>
                    <h3 className="font-sans font-extrabold text-base text-slate-800 dark:text-slate-100 mt-1">
                      {companyConfig?.companyName || 'Precision Metal Works'}
                    </h3>
                  </div>
                </div>

                <hr className="border-slate-100 dark:border-slate-800" />

                <div className="space-y-3.5 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 font-mono block uppercase">Corporate Details</span>
                    <p className="text-slate-600 dark:text-slate-350 font-medium leading-relaxed mt-0.5">
                      {companyConfig?.details || 'Specialists in high-tensile fasteners, engine components, and industrial finishes.'}
                    </p>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 font-mono block uppercase">Registered Contact</span>
                    <p className="font-semibold text-slate-700 dark:text-slate-200 mt-0.5">
                      {companyConfig?.phone || '+91 98765 43210'}
                    </p>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 font-mono block uppercase">GSTIN Registration</span>
                    <p className="font-mono text-slate-700 dark:text-slate-200 mt-0.5 font-bold">
                      {companyConfig?.gstIn || '27AAAAA1111A1Z1'}
                    </p>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 font-mono block uppercase">Physical Facility Address</span>
                    <p className="text-slate-500 dark:text-slate-400 leading-relaxed mt-0.5">
                      {companyConfig?.address || 'Shed No. 12, Phase II, Industrial Area, Pune, MH, India'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 text-[10px] font-mono text-slate-400 flex justify-between items-center">
                <span>Last Updated By:</span>
                <strong className="text-slate-600 dark:text-slate-300">
                  {companyConfig?.updatedBy || 'System Init'}
                </strong>
              </div>
            </div>

            {/* Editing Form */}
            <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
              <h4 className="font-sans font-bold text-sm text-slate-805 dark:text-slate-200 uppercase tracking-wider mb-4">
                Operational Identity Setup Form
              </h4>

              {isManager ? (
                <CompanyForm 
                  companyConfig={companyConfig} 
                  onSave={async (updated) => {
                    try {
                      const updatedWithMeta = {
                        ...updated,
                        updatedBy: currentUser?.name || 'Pawan Kumar',
                        updatedAt: new Date().toISOString()
                      };
                      await DBService.saveCompanyConfig(updatedWithMeta, currentUser?.userId || 'u-1', currentUser?.name || 'Pawan Kumar');
                      alert("Corporate Works Profile successfully synchronized to the secure cloud ledger!");
                      if (onRefreshCompany) onRefreshCompany();
                    } catch (err) {
                      console.error("Failed to save corporate parameters", err);
                      alert("Critical error: Unable to authenticate secure write block.");
                    }
                  }} 
                />
              ) : (
                <div className="p-8 border border-amber-200 bg-amber-50/50 dark:bg-slate-850 dark:border-slate-800 rounded-xl space-y-3 text-center">
                  <ShieldAlert className="h-8 w-8 text-amber-500 mx-auto" />
                  <h5 className="font-bold text-xs text-amber-900 dark:text-amber-400 uppercase tracking-wide">Access Restricted</h5>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                    Adjusting company metadata and global business registration parameters requires high-level administrative credentials. Operator accounts are authorized for passive inspection only.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

interface CompanyFormProps {
  companyConfig: CompanyConfig | null;
  onSave: (config: Omit<CompanyConfig, 'updatedBy' | 'updatedAt'>) => Promise<void>;
}

function CompanyForm({ companyConfig, onSave }: CompanyFormProps) {
  const [companyName, setCompanyName] = useState(companyConfig?.companyName || 'Precision Metal Works');
  const [details, setDetails] = useState(companyConfig?.details || 'Specialists in high-tensile fasteners, engine components, and industrial finishes.');
  const [phone, setPhone] = useState(companyConfig?.phone || '+91 98765 43210');
  const [address, setAddress] = useState(companyConfig?.address || 'Shed No. 12, Phase II, Industrial Area, Pune, MH, India');
  const [gstIn, setGstIn] = useState(companyConfig?.gstIn || '27AAAAA1111A1Z1');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (companyConfig) {
      setCompanyName(companyConfig.companyName);
      setDetails(companyConfig.details);
      setPhone(companyConfig.phone || '');
      setAddress(companyConfig.address || '');
      setGstIn(companyConfig.gstIn || '');
    }
  }, [companyConfig]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) {
      alert("Company Name is required.");
      return;
    }
    setSaving(true);
    try {
      await onSave({ companyName, details, phone, address, gstIn });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-xs">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5 col-span-1 md:col-span-2">
          <label className="block font-semibold text-slate-500 dark:text-slate-400">Registered Company Name *</label>
          <input
            type="text"
            required
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-850 rounded border border-slate-200 dark:border-slate-755 p-2.5 text-slate-850 dark:text-slate-100 font-sans focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 font-bold"
            placeholder="e.g. Precision Metal Works Ltd."
          />
        </div>

        <div className="space-y-1.5 col-span-1 md:col-span-2">
          <label className="block font-semibold text-slate-500 dark:text-slate-400">Works Scope / Operational Description</label>
          <textarea
            rows={3}
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-850 rounded border border-slate-200 dark:border-slate-755 p-2.5 text-slate-850 dark:text-slate-100 font-sans focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 animate-none resize-none"
            placeholder="Provide a summary of factory line specialty..."
          />
        </div>

        <div className="space-y-1.5">
          <label className="block font-semibold text-slate-500 dark:text-slate-400">Corporate Phone / Support Line</label>
          <input
            type="text"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-850 rounded border border-slate-200 dark:border-slate-755 p-2.5 text-slate-850 dark:text-slate-100 font-sans focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20"
            placeholder="e.g. +91 99999 88888"
          />
        </div>

        <div className="space-y-1.5">
          <label className="block font-semibold text-slate-500 dark:text-slate-400">Tax ID / GSTIN Registration</label>
          <input
            type="text"
            value={gstIn}
            onChange={(e) => setGstIn(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-850 rounded border border-slate-200 dark:border-slate-755 p-2.5 text-slate-850 dark:text-slate-100 font-mono focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 uppercase"
            placeholder="e.g. 27AAAAA1111A1Z1"
          />
        </div>

        <div className="space-y-1.5 col-span-1 md:col-span-2">
          <label className="block font-semibold text-slate-500 dark:text-slate-400">Factory Site Physical Address</label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-850 rounded border border-slate-200 dark:border-slate-755 p-2.5 text-slate-850 dark:text-slate-100 font-sans focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20"
            placeholder="e.g. Phase 2 Industrial Layout, Pune"
          />
        </div>
      </div>

      <div className="pt-2 text-right">
        <button
          type="submit"
          disabled={saving}
          className="bg-amber-600 hover:bg-amber-500 text-white font-sans font-bold text-xs py-2.5 px-6 rounded-xl shadow-sm transition border border-amber-700 cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
        >
          {saving ? 'Syncing...' : 'Save & Publish Profile'}
        </button>
      </div>
    </form>
  );
}
