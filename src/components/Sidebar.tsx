import React from 'react';
import { 
  Factory, 
  Truck, 
  Layers, 
  Flame, 
  ShieldCheck, 
  PackageCheck, 
  Warehouse, 
  Users, 
  FileText, 
  Bell, 
  Activity, 
  Moon, 
  Sun,
  UserPlus,
  X
} from 'lucide-react';
import { Department, UserProfile, CompanyConfig } from '../types';
import { isFirestoreOffline } from '../lib/firebase';

interface SidebarProps {
  currentUser: UserProfile;
  availableUsers: UserProfile[];
  onSwitchUser: (userId: string) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  darkMode: boolean;
  setDarkMode: (dark: boolean) => void;
  unreadCount: number;
  isOpen?: boolean;
  onClose?: () => void;
  companyConfig?: CompanyConfig | null;
}

export default function Sidebar({
  currentUser,
  availableUsers,
  onSwitchUser,
  activeTab,
  setActiveTab,
  darkMode,
  setDarkMode,
  unreadCount,
  isOpen,
  onClose,
  companyConfig = null
}: SidebarProps) {
  // Determine menu items based on department and role
  const isSystemAdmin = currentUser.role === 'admin' || currentUser.department === 'Admin';

  const menuItems = [
    { id: 'dashboard', label: 'Department Panel', icon: Factory },
    { id: 'all-orders', label: 'All Job Cards', icon: FileText },
    { id: 'timeline-live', label: 'Real-Time Tracking', icon: Activity },
    { id: 'reports', label: 'Reports & Analytics', icon: Layers },
  ];

  if (isSystemAdmin) {
    menuItems.push(
      { id: 'admin-users', label: 'User & Plant Manager', icon: Users }
    );
  }

  // Define department badges for UI styling
  const getDepartmentColor = (dept: string) => {
    switch (dept) {
      case 'Admin': return 'bg-cyan-600 text-white';
      case 'Dispatch': return 'bg-amber-600 text-white';
      case 'Production': return 'bg-blue-600 text-white';
      case 'Heat Treatment': return 'bg-red-600 text-white';
      case 'Plating': return 'bg-purple-600 text-white';
      case 'Packing': return 'bg-pink-600 text-white';
      case 'Store': return 'bg-emerald-600 text-white';
      default: return 'bg-gray-600 text-white';
    }
  };

  return (
    <aside className="w-full h-full bg-[#0F172A] text-[#E2E8F0] flex flex-col border-r border-[#1E293B]">
      {/* Top Header Logo */}
      <div className="p-5 border-b border-[#1E293B] flex items-center justify-between gap-2 text-ellipsis overflow-hidden">
        <div className="flex items-center gap-3 min-w-0">
          <Factory className="h-5 w-5 text-[#3B82F6] shrink-0" />
          <div className="min-w-0">
            <h1 className="font-sans font-extrabold leading-none tracking-tight text-xs text-white uppercase truncate text-ellipsis" title={companyConfig?.companyName || 'PRO-MFG TRACK'}>
              {companyConfig?.companyName || 'PRO-MFG TRACK'}
            </h1>
            <p className="font-mono text-[9px] text-slate-400 mt-1 uppercase tracking-wider flex items-center gap-1.5">
              <span>Site Node #1 Live</span>
              {isFirestoreOffline ? (
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" title="Local Storage Offline Fallback Mode" />
              ) : (
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" title="Connected to Firestore Cloud Storage" />
              )}
            </p>
          </div>
        </div>
        {onClose && (
          <button 
            onClick={onClose}
            className="lg:hidden p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
            title="Close navigation menu"
            id="btn_close_sidebar_icon"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* User Information Profile Block */}
      <div className="p-4 border-b border-[#1E293B] bg-[#0F172A]/40">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-[#1E293B] border border-slate-700 flex items-center justify-center text-[#3B82F6] font-bold uppercase text-xs">
            {currentUser.name.charAt(0)}
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-xs font-semibold text-white truncate text-ellipsis">
              {currentUser.name}
            </h4>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold tracking-wide ${getDepartmentColor(currentUser.department)}`}>
                {currentUser.department}
              </span>
              {currentUser.role === 'admin' && (
                <span className="text-[9px] bg-red-800 text-red-100 px-1 py-0.5 rounded font-bold uppercase">
                  ADM
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Primary Navigation Menu */}
      <nav className="flex-1 py-3 space-y-0.5 overflow-y-auto">
        <p className="text-[9px] text-slate-500 font-bold tracking-wider uppercase px-4 mb-2">
          Operations Nav
        </p>
        {menuItems.map((item) => {
          const IconComponent = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-xs font-semibold transition-all duration-200 text-left cursor-pointer ${
                isActive 
                  ? 'bg-[#1E293B] text-white border-l-4 border-[#3B82F6] opacity-100 pl-3' 
                  : 'text-[#E2E8F0] opacity-70 hover:opacity-100 hover:bg-[#1E293B] pl-4'
              }`}
            >
              <IconComponent className={`h-4 w-4 ${isActive ? 'text-[#3B82F6]' : 'text-slate-400'}`} />
              <span>{item.label}</span>
              {item.id === 'dashboard' && unreadCount > 0 && (
                <span className="ml-auto bg-blue-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                  {unreadCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Dark Mode and Utility Row */}
      <div className="p-3 border-t border-[#1E293B] flex items-center justify-between gap-2 bg-[#0F172A]/50">
        <span className="text-[11px] text-slate-400">Appearance</span>
        <button
          onClick={() => setDarkMode(!darkMode)}
          className="flex items-center justify-center p-1.5 rounded bg-[#1E293B] hover:bg-slate-700 text-slate-350 transition-colors cursor-pointer"
          title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
          {darkMode ? <Sun className="h-3.5 w-3.5 text-amber-400" /> : <Moon className="h-3.5 w-3.5 text-indigo-400" />}
        </button>
      </div>

      {/* DEMO Persona Switcher Block */}
      <div className="p-3 bg-[#0F172A]/90 border-t border-[#1E293B]">
        <label className="block text-[9px] text-[#3B82F6] font-bold uppercase tracking-wider mb-1.5">
          🛠️ Simulate Persona
        </label>
        <div className="relative">
          <select
            value={currentUser.userId}
            onChange={(e) => onSwitchUser(e.target.value)}
            className="w-full bg-[#1E293B] text-white text-[11px] py-1.5 px-2 pr-6 rounded border border-slate-700 focus:outline-none focus:border-[#3B82F6] cursor-pointer appearance-none"
          >
            {availableUsers.map(user => (
              <option key={user.userId} value={user.userId}>
                {user.department} - {user.name}
              </option>
            ))}
          </select>
          <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none text-slate-400">
            <UserPlus className="h-3 w-3" />
          </div>
        </div>
      </div>
    </aside>
  );
}
