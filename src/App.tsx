import React, { useState, useEffect, useRef } from 'react';
import { 
  Factory, 
  Bell, 
  Search, 
  Filter, 
  Download, 
  Activity, 
  LogOut,
  Mail,
  Lock,
  Moon,
  Sun,
  X,
  Plus,
  Key,
  Smartphone,
  UserPlus,
  CheckCircle,
  ArrowLeft,
  FileSpreadsheet,
  Menu,
  Trash2,
  Printer,
  QrCode,
  ArrowUpDown
} from 'lucide-react';
import { DBService, auth } from './lib/firebase';
import { UserProfile, JobCard, MaterialMovement, AppNotification, AuditLog, Department, CompanyConfig, JobCardStatus } from './types';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { 
  getSpreadsheetDetails, 
  isSheetsConnected, 
  setGoogleAccessToken, 
  initializeSpreadsheet, 
  disconnectSheets 
} from './lib/googleSheets';
import { 
  exportJobCards, 
  exportMaterialMovements, 
  exportAuditLogs, 
  exportDepartmentUpdates 
} from './lib/csvExport';
import Sidebar from './components/Sidebar';
import DashboardStats from './components/DashboardStats';
import DepartmentOperations from './components/DepartmentOperations';
import ForecastView from './components/ForecastView';
import JobCardDetailsModal from './components/JobCardDetailsModal';
import ScannerModal from './components/ScannerModal';
import ReportView from './components/ReportView';
import AdminConsole from './components/AdminConsole';
import TimelineVisual from './components/TimelineVisual';
import GoogleSheetViewer from './components/GoogleSheetViewer';
import { getJobCardProcessMetrics } from './lib/metrics';

export default function App() {
  // --- AUTH STATUS ---
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [loginName, setLoginName] = useState('');
  const [loginPin, setLoginPin] = useState('');
  const [authError, setAuthError] = useState('');

  // --- REGISTRATION FORM STATES ---
  const [isRegistering, setIsRegistering] = useState(false);
  const [regName, setRegName] = useState('');
  const [regSuccess, setRegSuccess] = useState('');

  // --- RECT ACTIVE STATE TABLES ---
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [jobCards, setJobCards] = useState<JobCard[]>([]);
  const [movements, setMovements] = useState<MaterialMovement[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [companyConfig, setCompanyConfig] = useState<CompanyConfig | null>(null);

  // --- VIEWPORT STATES ---
  const [activeTab, setActiveTab] = useState<'dashboard' | 'all-orders' | 'timeline-live' | 'reports' | 'admin-users' | string>('dashboard');
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('darkMode');
      if (saved !== null) {
        return saved === 'true';
      }
    }
    return false;
  });
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 1024;
    }
    return false;
  });

  // --- TOUCH SWIPE-TO-CLOSE GESTURE FOR SIDEBAR ---
  const sidebarRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);
  const touchCurrentX = useRef<number>(0);
  const isSwiping = useRef<boolean>(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!sidebarOpen || window.innerWidth >= 1024) return;
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    touchCurrentX.current = e.touches[0].clientX;
    isSwiping.current = false;
    
    if (sidebarRef.current) {
      // Disable transitions temporarily during drag for instant rendering response
      sidebarRef.current.style.transition = 'none';
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!sidebarOpen || window.innerWidth >= 1024) return;
    
    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const deltaX = currentX - touchStartX.current;
    const deltaY = currentY - touchStartY.current;

    if (!isSwiping.current) {
      const absDeltaX = Math.abs(deltaX);
      const absDeltaY = Math.abs(deltaY);
      
      // Stop tracking if vertical scroll is dominant to avoid interfering with scrolling down list of links
      if (absDeltaY > absDeltaX && absDeltaY > 8) {
        return;
      }
      
      // If horizontal swiping to the left is clear, enable swiping mode
      if (absDeltaX > absDeltaY && absDeltaX > 10 && deltaX < 0) {
        isSwiping.current = true;
      }
    }

    if (isSwiping.current) {
      // Prevent browser default behaviors like page pull-to-refresh or back navigation if swipe is active
      if (e.cancelable) {
        e.preventDefault();
      }
      // Translate the sidebar leftwards based on finger movement, capped at 0 (full screen fit)
      const translateVal = Math.min(0, deltaX);
      if (sidebarRef.current) {
        sidebarRef.current.style.transform = `translateX(${translateVal}px)`;
      }
      touchCurrentX.current = currentX;
    }
  };

  const handleTouchEnd = () => {
    if (!sidebarOpen || window.innerWidth >= 1024) return;
    
    if (sidebarRef.current) {
      // Reset the inline styles so CSS transitions take back control
      sidebarRef.current.style.transition = '';
      sidebarRef.current.style.transform = '';
    }

    if (isSwiping.current) {
      const deltaX = touchCurrentX.current - touchStartX.current;
      // Close the sidebar if dragged leftwards by more than 55 pixels
      if (deltaX < -55) {
        setSidebarOpen(false);
      }
    }
    isSwiping.current = false;
  };
  
  // --- GOOGLE WORKSPACE SYNC ---
  const [sheetsDetails, setSheetsDetails] = useState(getSpreadsheetDetails());
  const [isSheetsActive, setIsSheetsActive] = useState(isSheetsConnected());
  const [showSheetsModal, setShowSheetsModal] = useState(false);
  const [sheetsModalTab, setSheetsModalTab] = useState<'cloud' | 'offline'>('cloud');
  const [sheetsFeedback, setSheetsFeedback] = useState('');
  const [showSheetsInspector, setShowSheetsInspector] = useState(false);
  
  // --- MODALS AND DRILLS ---
  const [selectedJob, setSelectedJob] = useState<JobCard | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [showNotificationsDropdown, setShowNotificationsDropdown] = useState(false);

  // --- NON-BLOCKING TOASTS & CONFIRMATIONS ---
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    onConfirm: () => void | Promise<void>;
    confirmText?: string;
    cancelText?: string;
  } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(prev => prev?.message === message ? null : prev);
    }, 4500);
  };

  const showConfirm = (title: string, message: string, onConfirm: () => void | Promise<void>, confirmText = 'Confirm', cancelText = 'Cancel') => {
    setConfirmDialog({ title, message, onConfirm, confirmText, cancelText });
  };

  // --- FILTERS TABLE ---
  const [allOrdersSearch, setAllOrdersSearch] = useState('');
  const [allOrdersDeptFilter, setAllOrdersDeptFilter] = useState<string>('All');
  const [allOrdersStatusFilter, setAllOrdersStatusFilter] = useState<string>('All');
  const [mobileSortBy, setMobileSortBy] = useState<'Priority' | 'Newest' | 'Department'>('Priority');

  // --- LOAD INITIAL DATASE ---
  const refreshAllStates = async () => {
    try {
      const [u, jc, mov, n, logs, config] = await Promise.all([
        DBService.getUsers(),
        DBService.getJobCards(),
        DBService.getMovements(),
        DBService.getNotifications(),
        DBService.getAuditLogs(),
        DBService.getCompanyConfig()
      ]);

      setUsers(u);
      setJobCards(jc);
      setMovements(mov);
      setNotifications(n);
      setAuditLogs(logs);
      setCompanyConfig(config);

      setSelectedJob(prev => {
        if (!prev) return null;
        const freshJob = jc.find(j => j.jobCardNo.toLowerCase() === prev.jobCardNo.toLowerCase());
        return freshJob || prev;
      });

      // Handle user state persistence or automatic demo login if logged in previously
      const savedUserUid = sessionStorage.getItem('mfr_active_user_uid');
      if (savedUserUid && !currentUser) {
        const found = u.find(user => user.userId === savedUserUid);
        if (found) setCurrentUser(found);
      }

      // Deep link support for tracking QR Code clicks
      const urlParams = new URLSearchParams(window.location.search);
      const queryJobCardNo = urlParams.get('jobCardNo');
      if (queryJobCardNo && jc.length > 0) {
        const foundJob = jc.find(j => j.jobCardNo.toLowerCase() === queryJobCardNo.toLowerCase());
        if (foundJob) {
          setSelectedJob(foundJob);
          // Clean up query param from browser address bar smoothly
          const newUrl = window.location.pathname;
          window.history.replaceState({}, document.title, newUrl);
        }
      }
    } catch (err) {
      console.error("Failed to batch load local firestore fallback", err);
    }
  };

  useEffect(() => {
    refreshAllStates();

    // Debounce the refresh triggers to avoid flooding database connections on initial mount / batch updates
    let refreshTimeout: NodeJS.Timeout | null = null;
    const debouncedRefresh = () => {
      if (refreshTimeout) {
        clearTimeout(refreshTimeout);
      }
      refreshTimeout = setTimeout(() => {
        refreshAllStates();
      }, 100);
    };

    // Attach real-time subscription streams emulation triggers
    const unsubUsers = DBService.subscribeToUpdates('mfr_users', debouncedRefresh);
    const unsubJobs = DBService.subscribeToUpdates('mfr_job_cards', debouncedRefresh);
    const unsubMoves = DBService.subscribeToUpdates('mfr_movements', debouncedRefresh);
    const unsubNotifs = DBService.subscribeToUpdates('mfr_notifications', debouncedRefresh);
    const unsubAudits = DBService.subscribeToUpdates('mfr_audit_logs', debouncedRefresh);
    const unsubCompany = DBService.subscribeToUpdates('mfr_company_config', debouncedRefresh);

    return () => {
      if (refreshTimeout) clearTimeout(refreshTimeout);
      unsubUsers();
      unsubJobs();
      unsubMoves();
      unsubNotifs();
      unsubAudits();
      unsubCompany();
    };
  }, []);

  // --- THEME ENGINE ---
  useEffect(() => {
    const root = window.document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
      localStorage.setItem('darkMode', 'true');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('darkMode', 'false');
    }
  }, [darkMode]);

  // --- RESPONSIVE SIDEBAR AUTO-COLLAPSE ---
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setSidebarOpen(true);
      } else {
        setSidebarOpen(false);
      }
    };
    
    // Run initially
    handleResize();
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // --- CORE CALLBACK METRIC HANDLERS ---
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setRegSuccess('');

    const trimmedName = loginName.trim();

    if (!trimmedName) {
      setAuthError('Name is required.');
      return;
    }

    const found = users.find(u => u.name.toLowerCase() === trimmedName.toLowerCase() && u.active);
    if (!found) {
      setAuthError('Invalid credentials. Check your name.');
      return;
    }

    setCurrentUser(found);
    sessionStorage.setItem('mfr_active_user_uid', found.userId);
    setLoginName('');
    setLoginPin('');
    DBService.logAction(found.userId, found.name, 'USER_LOGIN', `Logged in.`);
  };

  const handleRegisterUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setRegSuccess('');

    const trimmedName = regName.trim();

    if (!trimmedName) {
      setAuthError('Name is required.');
      return;
    }

    const nameExists = users.some(u => u.name.toLowerCase() === trimmedName.toLowerCase());
    if (nameExists) {
      setAuthError('User name is already registered.');
      return;
    }

    const newUserId = `u-${Date.now()}`;
    const newProfile: UserProfile = {
      userId: newUserId,
      name: trimmedName,
      email: `${trimmedName.toLowerCase().replace(/\s+/g, '')}@factory.com`,
      pin: '0000', // Default PIN for compatibility
      department: 'Admin',
      role: 'admin',
      active: true,
      createdAt: new Date().toISOString()
    };

    try {
      await DBService.saveUser(newProfile);
      
      // Seed welcome notification
      await DBService.createNotification({
        department: 'All',
        title: 'New Manager Onboarded',
        message: `Manager ${trimmedName} registered with administrative access.`,
        userId: newUserId
      });

      setRegSuccess(`Manager account successfully created for ${trimmedName}! Please log in below.`);
      
      // Auto-prefill the login fields
      setLoginName(trimmedName);
      setRegName('');

      // Go back to login tab
      setIsRegistering(false);
    } catch (err) {
      setAuthError('Could not process registration.');
      console.error(err);
    }
  };

  const handleDemoQuickLogin = (user: UserProfile) => {
    setLoginName(user.name);
    setLoginPin(user.pin);
    setCurrentUser(user);
    sessionStorage.setItem('mfr_active_user_uid', user.userId);
    DBService.logAction(user.userId, user.name, 'USER_LOGIN', `Logged in via quick demo selector.`);
  };

  const handleLogout = () => {
    if (currentUser) {
      DBService.logAction(currentUser.userId, currentUser.name, 'USER_LOGOUT', 'Logged out of terminal');
    }
    setCurrentUser(null);
    sessionStorage.removeItem('mfr_active_user_uid');
  };

  const handleSwitchUserSimulated = (userId: string) => {
    const found = users.find(u => u.userId === userId);
    if (found) {
      setCurrentUser(found);
      sessionStorage.setItem('mfr_active_user_uid', found.userId);
      DBService.logAction(found.userId, found.name, 'SWITCH_ROLE', `Simulated operation shift switched department to ${found.department}`);
    }
  };

  const handleCreateSubJob = async (parentJob: JobCard) => {
    if (!currentUser) return;
    
    // Calculate pending quantity
    const totalMovedQty = movements.filter(m => m.jobCardNo.toLowerCase() === parentJob.jobCardNo.toLowerCase()).reduce((acc, curr) => acc + curr.quantity, 0);
    const pendingQty = parentJob.orderQty - totalMovedQty;
    
    if (pendingQty <= 0) {
      showToast("No pending quantity to split.", "error");
      return;
    }

    showConfirm(
      "Create Sub-Job",
      `Are you sure you want to split this job and create a new sub-job for ${pendingQty} KG from ${parentJob.jobCardNo}?`,
      async () => {
        // Create the new sub job based on parent job details
        const subJob = {
          partyName: parentJob.partyName,
          itemName: parentJob.itemName,
          itemCode: parentJob.itemCode,
          orderQty: pendingQty,
          currentQty: pendingQty,
          currentDepartment: 'Production' as Department,
          status: 'Pending' as JobCardStatus,
          heatTreatmentRequired: parentJob.heatTreatmentRequired,
          createdBy: currentUser.name,
        };

        try {
          await DBService.createJobCard(subJob, currentUser.userId, currentUser.name);
          showToast(`Sub-Job successfully created for ${pendingQty} KG!`, "success");
          refreshAllStates();
        } catch (err: any) {
          showToast(`Failed to create Sub-Job: ${err.message}`, "error");
        }
      }
    );
  };

  const handleCreateJobCard = async (job: any) => {
    if (!currentUser) return;
    console.log("Creating job card:", job);
    try {
      const newCard = await DBService.createJobCard(job, currentUser.userId, currentUser.name);
      console.log("Job card created:", newCard);
      showToast(`Job Card successfully created!`, "success");
      refreshAllStates();
    } catch (err: any) {
      console.error("Failed to create job card", err);
      showToast(`Failed to create Job Card: ${err instanceof Error ? err.message : String(err)}`, "error");
    }
  };

  const handleUpdateJobCard = async (jobCardNo: string, updates: any) => {
    if (!currentUser) return;
    try {
      await DBService.updateJobCard(jobCardNo, updates, currentUser.userId, currentUser.name);
      refreshAllStates();
    } catch (err: any) {
      console.error("Failed to update job card", err);
      showToast(`Failed to update Job Card: ${err instanceof Error ? err.message : String(err)}`, "error");
    }
  };

  const handleCreateMovement = async (mov: any) => {
    if (!currentUser) return;
    try {
      await DBService.createMovement(mov, currentUser.userId, currentUser.name);
      refreshAllStates();
    } catch (err: any) {
      console.error("Failed to transfer material", err);
      showToast(`Failed to transfer material: ${err instanceof Error ? err.message : String(err)}`, "error");
    }
  };

  const handleAcceptMovement = async (movementId: string, remarks?: string) => {
    if (!currentUser) return;
    try {
      await DBService.acceptMovement(movementId, currentUser.userId, currentUser.name, remarks);
      refreshAllStates();
    } catch (err: any) {
      console.error("Failed to accept movement", err);
      showToast(`Failed to accept material transfer: ${err instanceof Error ? err.message : String(err)}`, "error");
    }
  };

  const handleRejectMovement = async (movementId: string, remarks: string) => {
    if (!currentUser) return;
    try {
      await DBService.rejectMovement(movementId, currentUser.userId, currentUser.name, remarks);
      refreshAllStates();
    } catch (err: any) {
      console.error("Failed to reject movement", err);
      showToast(`Failed to reject material transfer: ${err instanceof Error ? err.message : String(err)}`, "error");
    }
  };

  const handleSaveUserProfile = async (profile: UserProfile) => {
    await DBService.saveUser(profile);
    refreshAllStates();
  };

  const handleDeleteUserProfile = async (userId: string, userName: string) => {
    if (!currentUser) return;
    await DBService.deleteUser(userId, userName, currentUser.userId, currentUser.name);
    refreshAllStates();
  };

  const handleLogActionExternally = async (action: string, details: string) => {
    if (!currentUser) return;
    await DBService.logAction(currentUser.userId, currentUser.name, action, details);
  };

  const handleSelectJobByNo = (jobNo: string) => {
    const found = jobCards.find(j => j.jobCardNo.toLowerCase() === jobNo.toLowerCase());
    if (found) {
      setSelectedJob(found);
    }
  };

  // --- GOOGLE WORKSPACE ACTION HANDLERS ---
  const handleConnectGoogleSheets = async () => {
    setSheetsFeedback('Connecting to Google Account...');
    try {
      const provider = new GoogleAuthProvider();
      provider.addScope('https://www.googleapis.com/auth/spreadsheets');
      provider.addScope('https://www.googleapis.com/auth/drive.file');
      
      let token = '';
      if (auth) {
        // Handle popup blocker gracefully
        const result = await signInWithPopup(auth, provider);
        const credential = GoogleAuthProvider.credentialFromResult(result);
        token = credential?.accessToken || '';
      } else {
        // Support emulation for high-fidelity offline tests
        token = 'dev-simulated-token-99933211-' + Math.random().toString(36).substring(7);
      }
      
      if (!token) {
        throw new Error("Missing Google Access Token. Please approve requested permissions.");
      }
      
      setGoogleAccessToken(token);
      setSheetsFeedback('Initializing "Factory Material Flow Ledger" Google Sheets tabs...');
      
      const id = await initializeSpreadsheet();
      const details = getSpreadsheetDetails();
      setSheetsDetails(details);
      setIsSheetsActive(true);
      setSheetsFeedback('');
      setShowSheetsModal(false);
      
      await DBService.logAction(
        currentUser?.userId || 'unknown',
        currentUser?.name || 'unknown',
        'CONNECT_GOOGLE_SHEETS',
        `Linked Google Spreadsheet "${details.name}" for live ledger synchronization.`
      );
    } catch (err: any) {
      console.error(err);
      setSheetsFeedback('Failed: ' + err.message);
    }
  };

  const handleDisconnectGoogleSheets = async () => {
    disconnectSheets();
    setIsSheetsActive(false);
    setSheetsDetails(getSpreadsheetDetails());
    
    await DBService.logAction(
      currentUser?.userId || 'unknown',
      currentUser?.name || 'unknown',
      'DISCONNECT_GOOGLE_SHEETS',
      `Unlinked Google Spreadsheet ledger connection.`
    );
  };

  // --- ATTACHMENTS MANAGER ---
  const handleUploadAttachment = async (jobCardNo: string, file: any) => {
    const updatedCards = [...jobCards];
    const idx = updatedCards.findIndex(c => c.jobCardNo.toLowerCase() === jobCardNo.toLowerCase());
    if (idx >= 0) {
      const card = updatedCards[idx];
      const files = (card as any).attachments || [];
      const updatedFiles = [...files, file];
      
      await DBService.updateJobCard(jobCardNo, {
        attachments: updatedFiles
      } as any, currentUser?.userId || 'unknown', currentUser?.name || 'unknown');
      
      await DBService.logAction(
        currentUser?.userId || 'unknown', 
        currentUser?.name || 'unknown', 
        'UPLOAD_ATTACHMENT', 
        `Uploaded document '${file.name}' to Job Card ${jobCardNo}`
      );
    }
  };

  const handleDeleteAttachment = async (jobCardNo: string, index: number) => {
    const updatedCards = [...jobCards];
    const idx = updatedCards.findIndex(c => c.jobCardNo.toLowerCase() === jobCardNo.toLowerCase());
    if (idx >= 0) {
      const card = updatedCards[idx];
      const files = (card as any).attachments || [];
      const updatedFiles = [...files];
      const removedText = updatedFiles[index]?.name || 'document';
      updatedFiles.splice(index, 1);
      
      await DBService.updateJobCard(jobCardNo, {
        attachments: updatedFiles
      } as any, currentUser?.userId || 'unknown', currentUser?.name || 'unknown');

      await DBService.logAction(
        currentUser?.userId || 'unknown', 
        currentUser?.name || 'unknown', 
        'DELETE_ATTACHMENT', 
        `Deleted document '${removedText}' from Job Card ${jobCardNo}`
      );
    }
  };

  // --- FILTERS LOGIC FOR ALL JOB CARDS VIEW ---
  const getFilteredAllOrdersList = () => {
    return jobCards.filter(j => {
      // 1. Search term
      const searchMatch = 
        j.jobCardNo.toLowerCase().includes(allOrdersSearch.toLowerCase()) ||
        j.partyName.toLowerCase().includes(allOrdersSearch.toLowerCase()) ||
        j.itemName.toLowerCase().includes(allOrdersSearch.toLowerCase()) ||
        j.itemCode.toLowerCase().includes(allOrdersSearch.toLowerCase());

      // 2. Department
      const deptMatch = allOrdersDeptFilter === 'All' || j.currentDepartment === allOrdersDeptFilter;

      // 3. Status
      const statusMatch = allOrdersStatusFilter === 'All' || j.status === allOrdersStatusFilter;

      return searchMatch && deptMatch && statusMatch;
    });
  };

  const filteredAllOrders = getFilteredAllOrdersList();

  const getSortedMobileOrders = () => {
    const list = [...filteredAllOrders];
    if (mobileSortBy === 'Newest') {
      return list.sort((a, b) => {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    }
    
    if (mobileSortBy === 'Department') {
      const deptOrder: Record<string, number> = {
        'Production': 1,
        'Heat Treatment': 2,
        'Plating': 3,
        'Packing': 4,
        'Store': 5,
        'Completed': 6,
        'Dispatch': 7
      };
      return list.sort((a, b) => {
        const orderA = deptOrder[a.currentDepartment] || 99;
        const orderB = deptOrder[b.currentDepartment] || 99;
        if (orderA !== orderB) return orderA - orderB;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    }
    
    if (mobileSortBy === 'Priority') {
      const statusOrder: Record<string, number> = {
        'Pending Acceptance': 1,
        'In Process': 2,
        'Pending': 3,
        'Rejected': 4,
        'Completed': 5
      };
      return list.sort((a, b) => {
        const orderA = statusOrder[a.status] || 99;
        const orderB = statusOrder[b.status] || 99;
        if (orderA !== orderB) return orderA - orderB;
        
        if (a.heatTreatmentRequired !== b.heatTreatmentRequired) {
          return a.heatTreatmentRequired ? -1 : 1;
        }

        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    }
    
    return list;
  };

  // --- NOTIFICATION CALCULATOR ---
  const activeDepartment = currentUser?.department === 'Admin' ? 'Admin' : currentUser?.department as Department;
  const filteredNotifications = notifications.filter(notif => {
    if (activeDepartment === 'Admin') return true;
    return notif.department === activeDepartment || notif.department === 'All';
  });

  const unreadNotificationsCount = filteredNotifications.filter(n => !n.read).length;

  const handleMarkNotifRead = async (id: string) => {
    await DBService.markNotificationRead(id);
    await refreshAllStates();
  };

  const handleMarkAllNotifsRead = async () => {
    const dept = activeDepartment || 'All';
    await DBService.clearAllNotifications(dept);
    await refreshAllStates();
    setShowNotificationsDropdown(false);
  };

  // Status Badge Styling Helper
  const getBadgeStyle = (status: string) => {
    switch (status) {
      case 'Pending': return 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/30';
      case 'In Process': return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900/30';
      case 'Completed': return 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/30';
      case 'Rejected': return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900/30';
      case 'Pending Acceptance': return 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-900/30';
      default: return 'bg-slate-105';
    }
  };

  // --- RENDER LOGIN VIEW IF NO REGISTERED PROFILE ---
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-center items-center p-4 font-sans selection:bg-[#3B82F6] selection:text-white">
        
        {/* Core ERP Login / Registration container card */}
        <div className="w-full max-w-4xl bg-white border border-[#E2E8F0] rounded-2xl shadow-xl overflow-hidden grid grid-cols-1 md:grid-cols-2">
          
          {/* Brand Presentation graphics Column */}
          <div className="bg-[#0F172A] p-10 flex flex-col justify-between border-r border-[#1E293B]">
            <div className="flex items-center gap-3">
              <Factory className="h-7 w-7 text-[#3B82F6]" />
              <div>
                <h2 className="text-sm font-extrabold text-white tracking-widest leading-none uppercase">PRO-MFG TRACK</h2>
                <span className="font-mono text-[9px] uppercase tracking-wider text-slate-400 mt-1 block">Workforce Operations v2.5</span>
              </div>
            </div>

            <div className="my-10 space-y-4">
              <h3 className="text-xl font-bold tracking-tight text-white leading-snug">
                Professional Production & Fastener Tracking System
              </h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                Complete traceability ledger recording material flow across Dispatch, Production, Heat Treatment, Plating, Packing, and Warehouse lines.
              </p>
            </div>

            <div className="flex items-center gap-2.5 text-[10.5px] text-slate-500 font-mono">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Plant Node Status: Live Connection Established</span>
            </div>
          </div>

          {/* Form Content Column */}
          <div className="p-8 md:p-10 flex flex-col justify-center bg-white space-y-6">
            
            {/* 1. REGISTRATION FORM MODE */}
            {isRegistering ? (
              <div className="space-y-4">
                <div>
                  <h3 className="text-base font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5 text-[#3B82F6]">
                    <UserPlus className="h-5 w-5" />
                    Manager Registration
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">Establish administrative credentials. Only Manager level accounts can be registered from this screen.</p>
                </div>

                {authError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-[#B91C1C] text-xs leading-normal font-semibold">
                    {authError}
                  </div>
                )}

                <form onSubmit={handleRegisterUser} className="space-y-4 text-xs font-sans">
                  <div>
                    <label className="block text-slate-600 font-bold mb-1.5 uppercase tracking-wide text-[10px]">Full Name</label>
                    <input
                      type="text"
                      placeholder="e.g. John Doe"
                      required
                      value={regName}
                      onChange={e => setRegName(e.target.value)}
                      className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-4 py-2.5 text-slate-800 focus:outline-none focus:border-[#3B82F6] font-medium"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-[#3B82F6] hover:bg-blue-600 text-white font-bold py-3 rounded-lg shadow-sm transition-all uppercase tracking-wider font-mono text-xs cursor-pointer border border-[#1D4ED8]"
                  >
                    Generate Manager Account
                  </button>
                </form>

                <div className="text-center pt-2">
                  <button
                    onClick={() => { setIsRegistering(false); setAuthError(''); }}
                    className="text-xs text-[#3B82F6] hover:underline font-bold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" /> Back to Login
                  </button>
                </div>
              </div>
            ) : (
              /* 2. LOGIN FORM MODE WITH PIN */
              <div className="space-y-4">
                <div>
                  <h3 className="text-base font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5 text-[#3B82F6]">
                    <Lock className="h-5 w-5" />
                    Personnel Access Port
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">Enter your registered Name to access the workstation terminal.</p>
                </div>

                {regSuccess && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs flex items-center gap-2 font-semibold">
                    <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>{regSuccess}</span>
                  </div>
                )}

                {authError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-[#B91C1C] text-xs leading-normal font-semibold">
                    {authError}
                  </div>
                )}

                <form onSubmit={handleLogin} className="space-y-4 text-xs font-sans">
                  <div>
                    <label className="block text-slate-600 font-bold mb-1.5 uppercase tracking-wide text-[10px]">Registered Full Name</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-450" />
                      <input
                        type="text"
                        placeholder="e.g. Pawan Kumar"
                        required
                        value={loginName}
                        onChange={e => setLoginName(e.target.value)}
                        className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg pl-10 pr-4 py-2.5 text-slate-800 focus:outline-none focus:border-[#3B82F6] font-medium"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-[#3B82F6] hover:bg-blue-600 text-white font-bold py-3 rounded-lg shadow-sm transition-all uppercase tracking-wider font-mono text-xs cursor-pointer border border-[#1D4ED8]"
                  >
                    Access Workspace Terminal
                  </button>
                </form>

                {/* Register/Signup Trigger link instead of Quick Login switches */}
                <div className="border-t border-[#E2E8F0] pt-4 text-center">
                  <button
                    onClick={() => { setIsRegistering(true); setAuthError(''); setRegSuccess(''); }}
                    className="text-xs text-[#3B82F6] hover:underline font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <UserPlus className="h-4 w-4" /> Create a Manager Account
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>

        <p className="text-[10px] text-slate-450 mt-6 font-mono text-center">
          Secured with robust token ledger tracking.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#F8FAFC] dark:bg-slate-950 transition-colors duration-200 font-sans overflow-hidden selection:bg-[#3B82F6] selection:text-white">
      
      {/* 1. SIDE NAVIGATION COLUMN Backdrop for mobile */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-40 lg:hidden animate-fade-in print:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      
      <div 
        ref={sidebarRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className={`
          fixed inset-y-0 left-0 z-50 transition-all duration-300 ease-in-out flex shrink-0 h-full print:hidden
          lg:static lg:z-0 lg:translate-x-0
          ${sidebarOpen ? 'translate-x-0 w-[220px]' : '-translate-x-full w-[220px] lg:w-0 lg:opacity-0 lg:overflow-hidden'}
        `}
      >
        <Sidebar 
          currentUser={currentUser}
          availableUsers={users}
          onSwitchUser={handleSwitchUserSimulated}
          activeTab={activeTab}
          setActiveTab={(tab) => {
            setActiveTab(tab);
            if (window.innerWidth < 1024) {
              setSidebarOpen(false);
            }
          }}
          darkMode={darkMode}
          setDarkMode={setDarkMode}
          unreadCount={unreadNotificationsCount}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          companyConfig={companyConfig}
        />
      </div>

      {/* 2. MAIN APPLICATION CONTENT WRAPPER */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#F8FAFC] dark:bg-slate-950">
        
        {/* Top Control Bar block */}
        <header className="h-16 border-b border-[#E2E8F0] dark:border-slate-850 px-3 sm:px-6 flex items-center justify-between bg-white dark:bg-slate-900 shrink-0 select-none print:hidden">
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-1.5 -ml-1 text-slate-500 hover:text-slate-705 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-805 rounded-lg transition-all cursor-pointer"
              title="Toggle Sidebar Menu"
              id="btn_toggle_sidebar"
            >
              <Menu className="h-5 w-5" />
            </button>
            <span className="text-xs text-slate-500 font-bold uppercase tracking-wider bg-[#F1F5F9] dark:bg-slate-850 py-1 px-3 rounded-full font-mono hidden sm:inline-block">
              Active Plant: Site #1
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 relative">
            
            {/* Google Sheets Live Syncer Status badge & controls */}
            {isSheetsActive ? (
              <div className="flex items-center gap-1">
                <a 
                  href={sheetsDetails.url || "#"} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/35 dark:hover:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900/45 text-emerald-700 dark:text-emerald-400 text-xs font-semibold font-sans transition-all"
                  title="Open live Google Sheets logbook in a new tab"
                >
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="hidden leading-none sm:inline">Sheets Synced</span>
                </a>
                <button
                  onClick={handleDisconnectGoogleSheets}
                  className="p-1.5 text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                  title="Disconnect Google Sheets sync"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowSheetsModal(true)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 text-xs font-semibold transition cursor-pointer"
                title="Connect real-time Google Sheets for logbook updates"
              >
                <div className="h-2 w-2 rounded-full bg-slate-350" />
                <span className="hidden sm:inline">Link Google Sheets</span>
                <span className="sm:hidden">Link Sheets</span>
              </button>
            )}


            {/* QR Code Scanner Button */}
            <button
              onClick={() => setScannerOpen(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 text-xs font-semibold transition cursor-pointer print:hidden"
              title="Scan or simulate physical Job Card QR labels"
              id="btn_qr_scanner"
            >
              <QrCode className="h-4 w-4 text-[#4F46E5] dark:text-[#818CF8]" />
              <span className="hidden sm:inline">QR Scanner</span>
              <span className="sm:hidden">Scan</span>
            </button>

            {/* Notification Bell with counter */}
            <div className="relative">
              <button
                onClick={() => setShowNotificationsDropdown(!showNotificationsDropdown)}
                className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-600 dark:text-slate-200 transition relative cursor-pointer"
                title="Active Plant Announcements"
              >
                <Bell className="h-4 w-4" />
                {unreadNotificationsCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white font-bold h-4 w-4 rounded-full flex items-center justify-center text-[8.5px] animate-pulse">
                    {unreadNotificationsCount}
                  </span>
                )}
              </button>

              {/* Announcements dropdown container */}
              {showNotificationsDropdown && (
                <div className="absolute right-0 mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-xl w-80 z-40 space-y-3">
                  <div className="flex items-center justify-between border-b pb-2 mb-1">
                    <span className="font-bold text-xs text-slate-905 dark:text-white uppercase tracking-wider">
                      Announcements Ledger ({filteredNotifications.length})
                    </span>
                    <button 
                      onClick={handleMarkAllNotifsRead}
                      className="text-[10px] text-[#3B82F6] hover:underline font-bold cursor-pointer"
                    >
                      Clear All
                    </button>
                  </div>

                  {filteredNotifications.length === 0 ? (
                    <p className="text-[10px] text-slate-400 italic font-mono py-2 text-center">No active system alerts recorded</p>
                  ) : (
                    <div className="space-y-2.5 max-h-60 overflow-y-auto">
                      {filteredNotifications.map(notif => (
                        <div 
                          key={notif.notificationId}
                          onClick={() => handleMarkNotifRead(notif.notificationId)}
                          className={`p-2 rounded-lg text-[11px] border transition cursor-pointer ${
                            notif.read 
                              ? 'bg-slate-50 dark:bg-slate-950/20 border-slate-100 dark:border-slate-850 text-slate-500' 
                              : 'bg-blue-500/10 border-blue-500/25 text-slate-800 dark:text-blue-400 font-medium'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <strong>{notif.title}</strong>
                            <span className="font-mono text-[8px] text-slate-400">
                              {new Date(notif.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                            </span>
                          </div>
                          <p className="mt-1 leading-normal text-slate-600 dark:text-slate-350">{notif.message}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Logout sign-off trigger */}
            <button
              onClick={handleLogout}
              className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-rose-500 transition cursor-pointer"
              title="Sign Out of Crew Terminal"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* 3. SCROLLABLE OPERATIONS CONTAINER */}
        <div className="flex-1 p-3 sm:p-6 space-y-4 sm:space-y-6 overflow-y-auto bg-[#F8FAFC] dark:bg-slate-950 print:p-0 print:overflow-visible">
          
          {/* Active stats display overview row */}
          {activeTab === 'dashboard' && (
            <DashboardStats 
              department={currentUser.department}
              jobCards={jobCards}
              movements={movements}
            />
          )}

          {/* RENDER VIEWPORT ACCORDING TO NAVIGATION */}
          {activeTab === 'dashboard' && (
            <DepartmentOperations
              currentUser={currentUser}
              jobCards={jobCards}
              movements={movements}
              onCreateJobCard={handleCreateJobCard}
              onUpdateJobCard={handleUpdateJobCard}
              onCreateMovement={handleCreateMovement}
              onAcceptMovement={handleAcceptMovement}
              onRejectMovement={handleRejectMovement}
              onSelectJobCard={setSelectedJob}
            />
          )}

          {activeTab === 'forecast' && (
            <ForecastView 
              jobCards={jobCards} 
              movements={movements} 
            />
          )}

          {/* ALL ORDERS GRID VIEW */}
          {activeTab === 'all-orders' && (
            <div className="space-y-4">
              
              {/* Header Titles */}
              <div className="flex justify-between items-center px-1">
                <div>
                  <h3 className="font-sans font-bold text-lg text-slate-805 dark:text-white uppercase tracking-wider">
                    Manufacturing Job Cards Database
                  </h3>
                  <p className="text-xs text-slate-400 italic">Entire plant ledger registry containing live queues</p>
                </div>
              </div>

              {/* Grid search and filtration row */}
              <div className="bg-white dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col md:flex-row gap-3 items-center justify-between text-xs">
                
                {/* Search string */}
                <div className="relative w-full md:w-80">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by Job Card No, Party Name, Item..."
                    value={allOrdersSearch}
                    onChange={(e) => setAllOrdersSearch(e.target.value)}
                    className="bg-slate-50 dark:bg-slate-850 pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-210 dark:border-slate-750 w-full focus:outline-none focus:border-amber-500"
                  />
                </div>

                {/* Dropdowns */}
                <div className="flex flex-wrap gap-2.5 items-center w-full md:w-auto">
                  <div className="flex items-center gap-1.5">
                    <Filter className="h-3.5 w-3.5 text-slate-400" />
                    <span className="text-slate-400 text-[11px] uppercase font-bold">Line Filter</span>
                  </div>
                  
                  <select
                    value={allOrdersDeptFilter}
                    onChange={(e) => setAllOrdersDeptFilter(e.target.value)}
                    className="bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-750 px-2.5 py-1.5 rounded-lg text-slate-700 dark:text-slate-200 focus:outline-none"
                  >
                    <option value="All">All Lines</option>
                    <option value="Production">Production Milling</option>
                    <option value="Heat Treatment">Heat Treatment Line</option>
                    <option value="Plating">Surface Plating</option>
                    <option value="Packing">Packing Line</option>
                    <option value="Store">Storehouse</option>
                    <option value="Completed">Completed Dispatch</option>
                  </select>

                  <select
                    value={allOrdersStatusFilter}
                    onChange={(e) => setAllOrdersStatusFilter(e.target.value)}
                    className="bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-750 px-2.5 py-1.5 rounded-lg text-slate-700 dark:text-slate-200 focus:outline-none"
                  >
                    <option value="All">All Statuses</option>
                    <option value="Pending">Pending</option>
                    <option value="In Process">In Process</option>
                    <option value="Pending Acceptance">Pending Acceptance</option>
                    <option value="Rejected">Rejected</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>
              </div>

              {/* Grid table */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                {/* Desktop View: Table */}
                <div className="hidden md:block overflow-x-auto">
                  {filteredAllOrders.length === 0 ? (
                    <div className="text-center p-12 space-y-1.5">
                      <span className="text-2xl">🔍</span>
                      <p className="text-sm font-semibold text-slate-450 font-mono">No active Job Cards match database filter parameters</p>
                    </div>
                  ) : (
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-950 text-[10px] text-slate-405 uppercase tracking-wider font-mono border-b border-slate-200 dark:border-slate-800">
                          <th className="py-3 px-3">Job Card</th>
                          <th className="py-3 px-3">Party Name</th>
                          <th className="py-3 px-3">Item Details</th>
                          <th className="py-3 px-3">Target (KG)</th>
                          <th className="py-3 px-3">Pending (KG)</th>
                          <th className="py-3 px-3">Action</th>
                          
                          {/* Production Stage columns */}
                          <th className="py-3 px-2 bg-blue-50/55 dark:bg-blue-950/25 text-blue-800 dark:text-blue-300 font-bold border-x border-slate-200/50 dark:border-slate-800/40 text-center">Recv (PROD)</th>
                          <th className="py-3 px-2 bg-blue-50/55 dark:bg-blue-950/25 text-blue-800 dark:text-blue-300 font-bold text-center">Rout (PLAT)</th>
                          <th className="py-3 px-2 bg-blue-50/55 dark:bg-blue-950/25 text-blue-800 dark:text-blue-300 font-bold border-r border-slate-200/50 dark:border-slate-800/40 text-center">Remain (PROD)</th>
                          
                          {/* Plating Stage columns */}
                          <th className="py-3 px-2 bg-purple-50/55 dark:bg-purple-950/25 text-purple-800 dark:text-purple-300 font-bold text-center">Recv (PLAT)</th>
                          <th className="py-3 px-2 bg-purple-50/55 dark:bg-purple-950/25 text-purple-800 dark:text-purple-300 font-bold border-x border-slate-200/50 dark:border-slate-800/40 text-center">Rout (PACK)</th>
                          <th className="py-3 px-2 bg-purple-50/55 dark:bg-purple-950/25 text-purple-800 dark:text-purple-300 font-bold border-r border-slate-200/50 dark:border-slate-800/40 text-center">Remain (PLAT)</th>
                          
                          {/* Packing Stage columns */}
                          <th className="py-3 px-2 bg-pink-50/55 dark:bg-pink-950/25 text-pink-800 dark:text-pink-300 font-bold text-center">Recv (PACK)</th>
                          <th className="py-3 px-2 bg-pink-50/55 dark:bg-pink-950/25 text-pink-800 dark:text-pink-300 font-bold border-x border-slate-200/50 dark:border-slate-800/40 text-center">Rout (STOR)</th>
                          <th className="py-3 px-2 bg-pink-50/55 dark:bg-pink-950/25 text-pink-800 dark:text-pink-300 font-bold border-r border-slate-200/50 dark:border-slate-800/40 text-center">Remain (PACK)</th>
                          
                          {/* Store columns */}
                          <th className="py-3 px-2 bg-emerald-50/55 dark:bg-emerald-950/25 text-emerald-800 dark:text-emerald-300 font-bold text-center">Dispatched</th>
                          <th className="py-3 px-2 bg-emerald-50/55 dark:bg-emerald-950/25 text-emerald-800 dark:text-emerald-300 font-bold border-l border-slate-200/50 dark:border-slate-800/40 text-center">In Stock</th>

                          <th className="py-3 px-3">Position</th>
                          <th className="py-3 px-3">Status</th>
                          <th className="py-3 px-3 text-center">Details</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredAllOrders.map(j => {
                          const m = getJobCardProcessMetrics(j, movements);
                          return (
                            <tr key={j.jobCardNo} className="border-b last:border-b-0 border-slate-200 dark:border-slate-850 hover:bg-slate-50/50 dark:hover:bg-slate-850/20 text-slate-700 dark:text-slate-300">
                              <td className="py-3 px-3 font-mono font-bold text-indigo-500 whitespace-nowrap">{j.jobCardNo}</td>
                              <td className="py-3 px-3 font-semibold text-slate-850 dark:text-slate-100 whitespace-nowrap leading-tight">{j.partyName}</td>
                              <td className="py-2 px-3">
                                <span className="block font-medium truncate max-w-[120px] text-slate-800 dark:text-slate-200" title={j.itemName}>{j.itemName}</span>
                                <span className="text-[9px] font-mono text-slate-400">{j.itemCode}</span>
                              </td>
                              <td className="py-3 px-3 font-mono font-bold">{j.orderQty.toLocaleString()}</td>
                              <td className="py-3 px-3 font-mono font-bold">{(j.orderQty - movements.filter(m => m.jobCardNo.toLowerCase() === j.jobCardNo.toLowerCase()).reduce((acc, curr) => acc + curr.quantity, 0)).toLocaleString()}</td>
                              <td className="py-3 px-3">
                                {j.orderQty - movements.filter(m => m.jobCardNo.toLowerCase() === j.jobCardNo.toLowerCase()).reduce((acc, curr) => acc + curr.quantity, 0) > 0 && (
                                  <button
                                    onClick={() => handleCreateSubJob(j)}
                                    className="px-2 py-1 bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200 rounded text-[9px] font-bold uppercase hover:bg-amber-200"
                                  >
                                    Create Sub-Job
                                  </button>
                                )}
                              </td>
                              
                              {/* Production values */}
                              <td className="py-3 px-2 bg-blue-50/10 dark:bg-blue-950/10 font-mono font-bold text-blue-700 dark:text-blue-400 border-x border-slate-200/30 text-center">{m.qtyReceivedFromProd.toLocaleString()}</td>
                              <td className="py-2 px-2 bg-blue-50/10 dark:bg-blue-950/10 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <input 
                                    type="number"
                                    min="0"
                                    title="Edit Routed to Plating Quantity"
                                    className="w-20 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-1.5 py-0.5 text-center font-mono font-medium text-blue-600 dark:text-blue-350 hover:border-slate-300 dark:hover:border-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs"
                                    value={j.customRoutedToPlating !== undefined && j.customRoutedToPlating !== null ? j.customRoutedToPlating : m.qtyRoutedToPlating}
                                    onChange={async (e) => {
                                      const val = e.target.value === '' ? null : Number(e.target.value);
                                      try {
                                        await DBService.updateJobCard(j.jobCardNo, { 
                                          customRoutedToPlating: val !== null ? val : undefined 
                                        }, currentUser?.userId || 'u-1', currentUser?.name || 'Pawan Kumar');
                                        refreshAllStates();
                                      } catch (err) {
                                        console.error("Failed to update custom Routed Plating value", err);
                                      }
                                    }}
                                  />
                                  <span className="text-[9px] text-slate-400 font-sans">KG</span>
                                </div>
                              </td>
                              <td className="py-3 px-2 bg-blue-50/10 dark:bg-blue-950/10 font-mono text-blue-500 dark:text-blue-300 text-center border-r border-slate-200/30">{m.qtyRemainingAtProd.toLocaleString()}</td>
                              
                              {/* Plating values */}
                              <td className="py-3 px-2 bg-purple-50/10 dark:bg-purple-950/10 font-mono font-semibold text-purple-700 dark:text-purple-400 text-center">{m.qtyReceivedAtPlating.toLocaleString()}</td>
                              <td className="py-3 px-2 bg-purple-50/10 dark:bg-purple-950/10 font-mono text-purple-600 dark:text-purple-350 text-center border-x border-slate-200/30">{m.qtyRoutedToPacking.toLocaleString()}</td>
                              <td className="py-3 px-2 bg-purple-50/10 dark:bg-purple-950/10 font-mono text-purple-500 dark:text-purple-300 text-center border-r border-slate-200/30">{m.qtyRemainingAtPlating.toLocaleString()}</td>
                              
                              {/* Packing values */}
                              <td className="py-3 px-2 bg-pink-50/10 dark:bg-pink-950/10 font-mono font-semibold text-pink-700 dark:text-pink-400 text-center">{m.qtyReceivedAtPacking.toLocaleString()}</td>
                              <td className="py-3 px-2 bg-pink-50/10 dark:bg-pink-950/10 font-mono text-pink-650 dark:text-pink-350 text-center border-x border-slate-200/30">{m.qtyRoutedToStore.toLocaleString()}</td>
                              <td className="py-3 px-2 bg-pink-50/10 dark:bg-pink-950/10 font-mono text-pink-500 dark:text-pink-300 text-center border-r border-slate-200/30">{m.qtyRemainingAtPacking.toLocaleString()}</td>
                              
                              {/* Store values */}
                              <td className="py-3 px-2 bg-emerald-50/10 dark:bg-emerald-950/10 font-mono text-emerald-700 dark:text-emerald-400 text-center">{m.qtyDispatched.toLocaleString()}</td>
                              <td className="py-3 px-2 bg-emerald-50/10 dark:bg-emerald-950/10 font-mono font-bold text-emerald-600 dark:text-emerald-300 text-center border-l border-slate-200/30">{m.qtyRemainingInStock.toLocaleString()}</td>

                              <td className="py-3 px-3 font-medium text-slate-500 whitespace-nowrap">{j.currentDepartment}</td>
                              <td className="py-3 px-3 whitespace-nowrap">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getBadgeStyle(j.status)}`}>
                                  {j.status}
                                </span>
                              </td>
                              <td className="py-3 px-3 text-center whitespace-nowrap">
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    onClick={() => setSelectedJob(j)}
                                    className="text-[10.5px] font-bold text-amber-500 hover:bg-amber-500/10 px-2.5 py-1.5 rounded transition"
                                  >
                                    Details
                                  </button>
                                  {(currentUser?.role === 'admin' || currentUser?.department === 'Admin') && (
                                    <button
                                      onClick={() => {
                                        showConfirm(
                                          "Delete Job Card",
                                          `Are you sure you want to permanently delete Job Card ${j.jobCardNo}? This action is completely irreversible, and all related material transitions and notifications will be deleted!`,
                                          async () => {
                                            try {
                                              await DBService.deleteJobCard(j.jobCardNo, currentUser?.userId || 'u-1', currentUser?.name || 'Pawan Kumar');
                                              showToast(`Job Card ${j.jobCardNo} has been deleted successfully.`, "success");
                                              refreshAllStates();
                                            } catch (err: any) {
                                              console.error("Failed to delete job card", err);
                                              showToast(`Failed to delete Job Card: ${err instanceof Error ? err.message : String(err)}`, "error");
                                            }
                                          }
                                        );
                                      }}
                                      className="p-1 px-1.5 rounded text-red-500 hover:bg-red-500/10 transition"
                                      title="Admin: Delete Selected Job Card"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Mobile View: Cards */}
                <div className="block md:hidden divide-y divide-slate-150 dark:divide-slate-800 bg-white dark:bg-slate-900 relative">
                  
                  {/* Sticky Sort Bar */}
                  <div className="sticky top-0 z-10 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-150 dark:border-slate-800 p-3 px-4 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wide">
                      <ArrowUpDown className="h-3.5 w-3.5 text-amber-500" />
                      <span>Sort By</span>
                    </div>
                    <select
                      value={mobileSortBy}
                      onChange={(e) => setMobileSortBy(e.target.value as any)}
                      className="bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-750 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:border-amber-500"
                    >
                      <option value="Priority">Priority</option>
                      <option value="Newest">Newest</option>
                      <option value="Department">Department</option>
                    </select>
                  </div>

                  {getSortedMobileOrders().length === 0 ? (
                    <div className="text-center p-8 space-y-1.5">
                      <span className="text-xl">🔍</span>
                      <p className="text-xs font-semibold text-slate-400 font-mono">No matching Job Cards found</p>
                    </div>
                  ) : (
                    getSortedMobileOrders().map(j => {
                      const m = getJobCardProcessMetrics(j, movements);
                      const totalTransferred = movements
                        .filter(mov => mov.jobCardNo.toLowerCase() === j.jobCardNo.toLowerCase())
                        .reduce((acc, curr) => acc + curr.quantity, 0);
                      const pendingQty = j.orderQty - totalTransferred;
                      
                      return (
                        <div key={j.jobCardNo} className="p-4 space-y-3">
                          {/* Card Header: Job Card No & Status */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 font-mono text-xs">
                              <span className="font-bold text-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded">
                                {j.jobCardNo}
                              </span>
                              <span className="text-[10px] text-slate-400 font-medium">
                                @ {j.currentDepartment}
                              </span>
                            </div>
                            <span className={`px-1.5 py-0.5 rounded text-[8.5px] font-bold border ${getBadgeStyle(j.status)}`}>
                              {j.status}
                            </span>
                          </div>

                          {/* Party and Item Details */}
                          <div>
                            <h4 className="font-bold text-slate-900 dark:text-white text-sm leading-tight">
                              {j.partyName}
                            </h4>
                            <p className="text-xs text-slate-600 dark:text-slate-350 mt-0.5">
                              {j.itemName} <span className="text-[10px] font-mono text-slate-400">({j.itemCode})</span>
                            </p>
                          </div>

                          {/* Quantities & Mini Stage Tracker */}
                          <div className="grid grid-cols-2 gap-2 bg-slate-50 dark:bg-slate-950 p-2 rounded-lg border border-slate-100 dark:border-slate-850 text-[11px]">
                            <div>
                              <span className="block text-[9px] text-slate-400 uppercase font-bold">Target Weight</span>
                              <span className="font-bold font-mono text-slate-800 dark:text-slate-200">{j.orderQty.toLocaleString()} KG</span>
                            </div>
                            <div>
                              <span className="block text-[9px] text-slate-400 uppercase font-bold">Pending Handoff</span>
                              <span className="font-bold font-mono text-slate-800 dark:text-slate-200">{pendingQty.toLocaleString()} KG</span>
                            </div>
                          </div>

                          {/* Stages Progress Indicator */}
                          <div className="space-y-1.5 pt-1">
                            <span className="block text-[9px] text-slate-400 uppercase font-bold tracking-wider">Line Progress Ledger</span>
                            <div className="grid grid-cols-4 gap-1.5 text-center text-[9px] font-mono">
                              <div className="bg-blue-50/50 dark:bg-blue-950/20 p-1.5 rounded border border-blue-100/30">
                                <span className="block text-[8px] text-blue-800 dark:text-blue-300 font-bold uppercase">PROD</span>
                                <span className="block font-bold text-slate-700 dark:text-slate-300">{m.qtyRemainingAtProd.toLocaleString()}</span>
                              </div>
                              <div className="bg-purple-50/50 dark:bg-purple-950/20 p-1.5 rounded border border-purple-100/30">
                                <span className="block text-[8px] text-purple-800 dark:text-purple-300 font-bold uppercase">PLAT</span>
                                <span className="block font-bold text-slate-700 dark:text-slate-300">{m.qtyRemainingAtPlating.toLocaleString()}</span>
                              </div>
                              <div className="bg-pink-50/50 dark:bg-pink-950/20 p-1.5 rounded border border-pink-100/30">
                                <span className="block text-[8px] text-pink-800 dark:text-pink-300 font-bold uppercase">PACK</span>
                                <span className="block font-bold text-slate-700 dark:text-slate-300">{m.qtyRemainingAtPacking.toLocaleString()}</span>
                              </div>
                              <div className="bg-emerald-50/50 dark:bg-emerald-950/20 p-1.5 rounded border border-emerald-100/30">
                                <span className="block text-[8px] text-emerald-800 dark:text-emerald-300 font-bold uppercase">STOCK</span>
                                <span className="block font-bold text-slate-700 dark:text-slate-300">{m.qtyRemainingInStock.toLocaleString()}</span>
                              </div>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800">
                            <div>
                              {pendingQty > 0 ? (
                                <button
                                  onClick={() => handleCreateSubJob(j)}
                                  className="px-2 py-1 bg-amber-100 dark:bg-amber-900 text-amber-850 dark:text-amber-200 rounded text-[9px] font-extrabold uppercase hover:bg-amber-200 transition"
                                >
                                  Sub-Job
                                </button>
                              ) : (
                                <span className="text-[9px] text-emerald-600 dark:text-emerald-450 font-bold uppercase">Fully Routed</span>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setSelectedJob(j)}
                                className="text-[10px] font-extrabold text-amber-500 hover:bg-amber-500/10 px-2 py-1 rounded transition"
                              >
                                View Details
                              </button>
                              {(currentUser?.role === 'admin' || currentUser?.department === 'Admin') && (
                                <button
                                  onClick={() => {
                                    showConfirm(
                                      "Delete Job Card",
                                      `Are you sure you want to permanently delete Job Card ${j.jobCardNo}? This action is completely irreversible, and all related material transitions and notifications will be deleted!`,
                                      async () => {
                                        try {
                                          await DBService.deleteJobCard(j.jobCardNo, currentUser?.userId || 'u-1', currentUser?.name || 'Pawan Kumar');
                                          showToast(`Job Card ${j.jobCardNo} has been deleted successfully.`, "success");
                                          refreshAllStates();
                                        } catch (err: any) {
                                          console.error("Failed to delete job card", err);
                                          showToast(`Failed to delete Job Card: ${err instanceof Error ? err.message : String(err)}`, "error");
                                        }
                                      }
                                    );
                                  }}
                                  className="p-1 px-1.5 rounded text-red-500 hover:bg-red-500/10 transition"
                                  title="Admin: Delete Selected Job Card"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

            </div>
          )}

          {/* REAL TIME LOGS MOVEMENT LEDGER VIEW */}
          {activeTab === 'timeline-live' && (
            <div className="space-y-4">
              <div className="px-1">
                <h3 className="font-sans font-bold text-lg text-slate-850 dark:text-white uppercase tracking-wider">
                  Real-Time Chronological Transit Ledger
                </h3>
                <p className="text-xs text-slate-400 italic">Continuous live logging capturing exact component coordinates</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Movement list column */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4 shadow-sm">
                  <h4 className="font-sans font-bold text-sm uppercase tracking-wider text-slate-500 border-b pb-2 mb-2">
                    Chronological Queue Transfers Ledger
                  </h4>

                  <div className="space-y-3 max-h-[500px] overflow-y-auto">
                    {movements.map((mov, mIdx) => (
                      <div 
                        key={mov.movementId}
                        className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl space-y-2 text-xs hover:border-slate-350"
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-mono font-bold text-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded text-[10px]">
                            {mov.jobCardNo}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {new Date(mov.transferDate).toLocaleDateString([], {hour: '2-digit', minute:'2-digit'})}
                          </span>
                        </div>

                        <p className="font-semibold text-slate-800 dark:text-slate-200">
                          {mov.fromDepartment} → {mov.toDepartment}
                        </p>

                        <div className="flex justify-between items-center font-mono text-[10px] text-slate-500 mt-1">
                          <span>Mass moved: <strong>{mov.quantity} KG</strong></span>
                          <span>Billed By: {mov.transferBy}</span>
                        </div>

                        {mov.accepted ? (
                          <div className="text-[9px] bg-emerald-500/10 text-emerald-600 font-bold p-1 rounded flex items-center gap-1 mt-1">
                            ✔️ Custody accepted by {mov.acceptedBy} on {new Date(mov.acceptedDate!).toLocaleDateString([], {hour:'2-digit', minute:'2-digit'})}
                          </div>
                        ) : (
                          <div className="text-[9px] bg-purple-500/10 text-purple-600 font-bold p-1 rounded flex items-center gap-1 mt-1">
                            ⌛ Transit verification pending at downstream
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Active live Trace visual selection of last card */}
                <div className="space-y-4">
                  <div className="p-4 bg-slate-900 border border-slate-800 text-white rounded-xl">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-amber-500 mb-1.5 col-span-2">
                      Interactive Live Trace Inspector
                    </h4>
                    <p className="text-[11px] text-slate-400 leading-normal">
                      Select any active manufacturing batch from the drop-down below to visualize their position in the 7-node chain.
                    </p>
                    
                    <div className="relative mt-3">
                      <select
                        onChange={(e) => handleSelectJobByNo(e.target.value)}
                        className="w-full bg-slate-800 text-white text-xs py-2 px-3 pr-8 rounded border border-slate-700 font-mono cursor-pointer"
                      >
                        <option value="">-- Select Active Job Card --</option>
                        {jobCards.map(c => (
                          <option key={c.jobCardNo} value={c.jobCardNo}>
                            [{c.jobCardNo}] - {c.itemName}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {jobCards.length > 0 && (
                    <TimelineVisual 
                      jobCard={jobCards[0]} 
                      movements={movements.filter(m => m.jobCardNo.toLowerCase() === jobCards[0].jobCardNo.toLowerCase())} 
                    />
                  )}
                </div>

              </div>
            </div>
          )}

          {/* REPORTS EXPORT VIEW */}
          {activeTab === 'reports' && (
            <ReportView 
              jobCards={jobCards}
              movements={movements}
            />
          )}

          {/* ADMINISTRATOR CONSOLE PORTAL */}
          {activeTab === 'admin-users' && (
            <AdminConsole 
              users={users}
              auditLogs={auditLogs}
              onSaveUser={handleSaveUserProfile}
              onLogAction={handleLogActionExternally}
              currentUser={currentUser}
              onDeleteUser={handleDeleteUserProfile}
              jobCards={jobCards}
              movements={movements}
              onRefreshJobs={refreshAllStates}
              companyConfig={companyConfig}
              onRefreshCompany={refreshAllStates}
              isSheetsActive={isSheetsActive}
              sheetsDetails={sheetsDetails}
              onOpenSheetsModal={() => setShowSheetsModal(true)}
              onDisconnectSheets={handleDisconnectGoogleSheets}
              onOpenSheetsInspector={() => setShowSheetsInspector(true)}
            />
          )}

        </div>
      </main>

      {/* ======================================================== */}
      {/* 3. MODALS AND DETAILS OVERLAY DRAWERS */}
      {/* ======================================================== */}
      
      {/* QR Code Scanner Modal */}
      <ScannerModal 
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        jobCards={jobCards}
        onSelectJobCard={handleSelectJobByNo}
      />
      


      {/* Job Card Detailed Drill overlay */}
      {selectedJob && (
        <JobCardDetailsModal 
          isOpen={!!selectedJob}
          onClose={() => setSelectedJob(null)}
          jobCard={selectedJob}
          movements={movements}
          currentUser={currentUser}
          onUploadAttachment={handleUploadAttachment}
          onDeleteAttachment={handleDeleteAttachment}
        />
      )}

      {/* Google Sheets Sync Setup Modal */}
      {showSheetsModal && (
        <div className="fixed inset-0 bg-slate-900/45 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative font-sans">
            <button 
              onClick={() => { setShowSheetsModal(false); setSheetsFeedback(''); }}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition cursor-pointer"
              id="btn_close_sheets_modal"
            >
              <X className="h-5 w-5" />
            </button>
            
            <div className="flex items-center gap-3 border-b pb-4 mb-4">
              <div className="h-10 w-10 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                <FileSpreadsheet className="h-6 w-6" id="header_sheets_icon" />
              </div>
              <div>
                <h3 className="font-bold text-slate-850 dark:text-slate-100 text-sm">Spreadsheet Logs & Exporter</h3>
                <p className="text-[11px] text-slate-400 font-medium">Manage cloud syncer and offline Excel-ready spreadsheet files</p>
              </div>
            </div>

            {/* Tabs for Google Sheets vs Local Excel/CSV export */}
            <div className="flex border-b border-slate-200 dark:border-slate-800 mb-5 font-sans text-xs">
              <button
                onClick={() => setSheetsModalTab('cloud')}
                className={`flex-1 pb-2.5 font-bold border-b-2 text-center transition cursor-pointer ${
                  sheetsModalTab === 'cloud'
                    ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                    : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-350'
                }`}
              >
                ☁️ Google Sheets (Cloud Sync)
              </button>
              <button
                onClick={() => setSheetsModalTab('offline')}
                className={`flex-1 pb-2.5 font-bold border-b-2 text-center transition cursor-pointer ${
                  sheetsModalTab === 'offline'
                    ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                    : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-350'
                }`}
              >
                📊 Excel Ledger Export (Offline)
              </button>
            </div>

            {sheetsModalTab === 'cloud' ? (
              <div className="space-y-4 text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-sans">
                <p>
                  Link your Google Sheets account to sync all transactions, movements, and rejections dynamically:
                </p>
                
                <ul className="list-disc pl-5 space-y-2 text-slate-500 font-sans">
                  <li>Records new Customer Job Cards & Route Targets automatically.</li>
                  <li>Logs step-by-step Department records (Heat Treatment, Plating, Packing, Warehouse).</li>
                  <li>Calculates and logs Furnace, Coating, and Boxing rejections (KG weight metrics).</li>
                  <li>Inserts audit action timestamps and personnel sign-off names.</li>
                </ul>

                {sheetsFeedback && (
                  <div className="p-3 bg-blue-50 dark:bg-blue-950/30 text-[#3B82F6] dark:text-blue-400 rounded-lg text-xs font-semibold border border-blue-200 dark:border-blue-900/40 flex items-center gap-2 font-mono">
                    <span className="h-2 w-2 rounded-full bg-blue-500 animate-ping shrink-0" />
                    <span>{sheetsFeedback}</span>
                  </div>
                )}

                <div className="pt-2 flex flex-col gap-2">
                  <button
                    onClick={handleConnectGoogleSheets}
                    className="w-full bg-[#107C41] hover:bg-[#0B592E] text-white font-bold py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 shadow-sm transition uppercase tracking-wider text-[11px] font-mono cursor-pointer border border-[#0B5927]"
                    id="btn_auth_sheets"
                  >
                    <FileSpreadsheet className="h-4 w-4" />
                    <span>Link via Google Account</span>
                  </button>
                  <p className="text-[9.5px] text-center text-slate-450 font-light pt-1">
                    Secure OAuth token integration. Google Sheets permission is sandbox restricted to spreadsheets created by this app.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4 text-xs leading-relaxed font-sans">
                <p className="text-slate-600 dark:text-slate-400">
                  Generate and download standard offline Excel-ready spreadsheet files of any data collection instantly:
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <button
                    onClick={() => exportJobCards(jobCards)}
                    className="flex flex-col items-start p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-left transition cursor-pointer"
                  >
                    <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 mb-1 text-[11.5px]">
                      📑 Job Cards Ledger
                    </span>
                    <span className="text-[10px] text-slate-400">Download customer orders and line statuses.</span>
                  </button>

                  <button
                    onClick={() => exportDepartmentUpdates(jobCards)}
                    className="flex flex-col items-start p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-left transition cursor-pointer"
                  >
                    <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 mb-1 text-[11.5px]">
                      ⚡ Process & Rejections
                    </span>
                    <span className="text-[10px] text-slate-400">Download logs of hardness, temperature, plating and packing.</span>
                  </button>

                  <button
                    onClick={() => exportMaterialMovements(movements)}
                    className="flex flex-col items-start p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-left transition cursor-pointer"
                  >
                    <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 mb-1 text-[11.5px]">
                      🔄 Custody & Movements
                    </span>
                    <span className="text-[10px] text-slate-400">Download the complete material transfer trail logs.</span>
                  </button>

                  <button
                    onClick={() => exportAuditLogs(auditLogs)}
                    className="flex flex-col items-start p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-left transition cursor-pointer"
                  >
                    <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 mb-1 text-[11.5px]">
                      🛡️ Actions & Audits
                    </span>
                    <span className="text-[10px] text-slate-400">Download staff logins and database update log trails.</span>
                  </button>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 text-center">
                  <p className="text-[10px] text-slate-400">
                    No sign-in required. Downloads are processed entirely inside your local sandbox.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Google Sheets Live Data Inspector Overlay Modal */}
      {showSheetsInspector && (
        <GoogleSheetViewer
          onClose={() => setShowSheetsInspector(false)}
          spreadsheetName={sheetsDetails.name || undefined}
          spreadsheetUrl={sheetsDetails.url || undefined}
        />
      )}

      {/* Custom Confirmation Dialog Overlay */}
      {confirmDialog && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              ⚠️ {confirmDialog.title}
            </h3>
            <p className="text-sm text-slate-605 dark:text-slate-300 mt-3 whitespace-pre-wrap leading-relaxed">
              {confirmDialog.message}
            </p>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setConfirmDialog(null)}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl text-xs font-semibold transition cursor-pointer"
              >
                {confirmDialog.cancelText || 'Cancel'}
              </button>
              <button
                onClick={async () => {
                  const onConf = confirmDialog.onConfirm;
                  setConfirmDialog(null);
                  await onConf();
                }}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold transition shadow-md hover:shadow-lg cursor-pointer"
              >
                {confirmDialog.confirmText || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Non-blocking Toast Alerts */}
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[999] max-w-sm w-full px-4 animate-bounce-in">
          <div className={`
            flex items-center gap-3 p-4 rounded-xl shadow-lg border text-sm font-medium
            ${toast.type === 'success' 
              ? 'bg-emerald-50 dark:bg-emerald-950/85 border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-200' 
              : toast.type === 'error'
              ? 'bg-rose-50 dark:bg-rose-950/85 border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200'
              : 'bg-blue-50 dark:bg-blue-950/85 border-blue-200 dark:border-blue-900 text-blue-800 dark:text-blue-200'}
          `}>
            <div className="shrink-0">
              {toast.type === 'success' ? '✅' : toast.type === 'error' ? '❌' : 'ℹ️'}
            </div>
            <div className="grow text-xs leading-normal">
              {toast.message}
            </div>
            <button 
              onClick={() => setToast(null)}
              className="text-slate-450 hover:text-slate-600 dark:hover:text-slate-200 shrink-0 cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
