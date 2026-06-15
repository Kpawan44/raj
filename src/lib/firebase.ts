import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  getDocFromServer, 
  collection, 
  getDocs, 
  getDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  limit 
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { UserProfile, JobCard, MaterialMovement, AppNotification, AuditLog, Department, CompanyConfig } from '../types';
import { 
  logJobCardToSheets, 
  logDepartmentUpdateToSheets, 
  logMaterialMovementToSheets, 
  logActionToSheets 
} from './googleSheets';

// Let's check if the configuration consists of placeholders
const isPlaceholder = 
  !firebaseConfig || 
  firebaseConfig.apiKey === 'placeholder-api-key' || 
  !firebaseConfig.apiKey;

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

// Global offline/error state tracker for UI
export let isFirestoreOffline = false;

// Global handleFirestoreError to wrap Firestore operations
export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  isFirestoreOffline = true;
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: isPlaceholder ? 'mock-user' : getAuth().currentUser?.uid,
      email: isPlaceholder ? 'pawan.kummar16@gmail.com' : getAuth().currentUser?.email,
      emailVerified: true,
      isAnonymous: false,
    },
    operationType,
    path
  };
  console.warn('Firestore Operation Offline/Deferred: ', JSON.stringify(errInfo));
}

// Setup real Firebase
let dbInstance: any = null;
let authInstance: any = null;
let useRealFirebase = false;

console.log("Starting app in HIGH-FIDELITY LOCAL STORAGE EMULATION mode (Real Firebase disabled).");

export { useRealFirebase };
export const db = dbInstance;
export const auth = authInstance;

// ============================================
// MOCK STATE AND REALTIME STREAM DATABASE
// ============================================

// Standard initial seed data for demonstration
const defaultUsers: UserProfile[] = [
  {
    userId: 'u-1',
    name: 'Pawan Kumar',
    email: 'pawan.kummar16@gmail.com',
    pin: '1234',
    department: 'Admin',
    role: 'admin',
    active: true,
    createdAt: new Date().toISOString()
  },
  {
    userId: 'u-2',
    name: 'Alice Dispatcher',
    email: 'dispatch@factory.com',
    pin: '2222',
    department: 'Dispatch',
    role: 'staff',
    active: true,
    createdAt: new Date().toISOString()
  },
  {
    userId: 'u-3',
    name: 'Bob Production',
    email: 'production@factory.com',
    pin: '3333',
    department: 'Production',
    role: 'staff',
    active: true,
    createdAt: new Date().toISOString()
  },
  {
    userId: 'u-4',
    name: 'Charlie HeatTreat',
    email: 'heattreat@factory.com',
    pin: '4444',
    department: 'Heat Treatment',
    role: 'staff',
    active: true,
    createdAt: new Date().toISOString()
  },
  {
    userId: 'u-5',
    name: 'David Plater',
    email: 'plating@factory.com',
    pin: '5555',
    department: 'Plating',
    role: 'staff',
    active: true,
    createdAt: new Date().toISOString()
  },
  {
    userId: 'u-6',
    name: 'Emma Packer',
    email: 'packing@factory.com',
    pin: '6666',
    department: 'Packing',
    role: 'staff',
    active: true,
    createdAt: new Date().toISOString()
  },
  {
    userId: 'u-7',
    name: 'Frank Storekeeper',
    email: 'store@factory.com',
    pin: '7777',
    department: 'Store',
    role: 'staff',
    active: true,
    createdAt: new Date().toISOString()
  }
];

const defaultJobCards: JobCard[] = [
  {
    jobCardNo: 'JC-1001',
    orderNo: 'ORD-5001',
    partyName: 'Apex Engineering Solutions',
    itemName: 'Grade 8 High-Tensile Bolt M12',
    itemCode: 'BOLT-M12-G8',
    orderQty: 1200,
    currentQty: 1200,
    balanceQty: 1200,
    currentDepartment: 'Production',
    status: 'Pending',
    heatTreatmentRequired: true,
    createdBy: 'Pawan Kumar',
    createdAt: new Date(Date.now() - 3600000 * 24 * 3).toISOString(), // 3 days ago
    completed: false
  },
  {
    jobCardNo: 'JC-1002',
    orderNo: 'ORD-5002',
    partyName: 'Precision Automotive Parts',
    itemName: 'Engine Valve Gear Shaft',
    itemCode: 'SHAFT-EVG-102',
    orderQty: 500,
    currentQty: 450,
    balanceQty: 50,
    currentDepartment: 'Heat Treatment',
    status: 'In Process',
    heatTreatmentRequired: true,
    createdBy: 'Pawan Kumar',
    createdAt: new Date(Date.now() - 3600000 * 24 * 1.5).toISOString(),
    completed: false
  },
  {
    jobCardNo: 'JC-1003',
    orderNo: 'ORD-5003',
    partyName: 'Alpha Heavy Industries',
    itemName: 'Industrial Galvanized Washer',
    itemCode: 'WASH-GALV-50',
    orderQty: 3000,
    currentQty: 3000,
    balanceQty: 0,
    currentDepartment: 'Completed',
    status: 'Completed',
    heatTreatmentRequired: false,
    createdBy: 'Alice Dispatcher',
    createdAt: new Date(Date.now() - 3600000 * 24 * 5).toISOString(),
    completed: true,
    dispatchDetails: {
      invoiceNo: 'INV-2026-001',
      vehicleNo: 'MH-12-PQ-9876',
      dispatchQty: 3000,
      dispatchDate: new Date(Date.now() - 3600000 * 4).toISOString(),
      remarks: 'Delivered in perfect condition. Inspection sign-off completed.'
    }
  }
];

const defaultMovements: MaterialMovement[] = [
  {
    movementId: 'M-2001',
    jobCardNo: 'JC-1002',
    fromDepartment: 'Dispatch',
    toDepartment: 'Production',
    quantity: 500,
    transferBy: 'Alice Dispatcher',
    transferDate: new Date(Date.now() - 3600000 * 24 * 1.4).toISOString(),
    accepted: true,
    acceptedBy: 'Bob Production',
    acceptedDate: new Date(Date.now() - 3600000 * 24 * 1.3).toISOString(),
    remarks: 'Dispatched raw material bars'
  },
  {
    movementId: 'M-2002',
    jobCardNo: 'JC-1002',
    fromDepartment: 'Production',
    toDepartment: 'Heat Treatment',
    quantity: 450,
    transferBy: 'Bob Production',
    transferDate: new Date(Date.now() - 3600000 * 24 * 1.1).toISOString(),
    accepted: true,
    acceptedBy: 'Charlie HeatTreat',
    acceptedDate: new Date(Date.now() - 3600000 * 24 * 1.0).toISOString(),
    remarks: 'Produced with 50 KG scrap loss due to edge trimming.',
    processDetails: {
      operatorName: 'Suresh Patil'
    }
  }
];

const defaultNotifications: AppNotification[] = [
  {
    notificationId: 'N-3001',
    userId: 'u-3',
    department: 'Production',
    title: 'New Job Card Created',
    message: 'Job Card JC-1001 for Apex Engineering Solutions (BOLT-M12-G8) is pending production.',
    read: false,
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString()
  },
  {
    notificationId: 'N-3002',
    userId: 'u-4',
    department: 'Heat Treatment',
    title: 'Material Transferred',
    message: 'Bob Production transferred 450 KG of JC-1002 for Heat Treatment.',
    read: false,
    createdAt: new Date(Date.now() - 3600000).toISOString()
  }
];

const defaultAuditLogs: AuditLog[] = [
  {
    id: 'AL-1',
    timestamp: new Date(Date.now() - 3600000 * 4).toISOString(),
    userId: 'u-1',
    userName: 'Pawan Kumar',
    action: 'USER_LOGIN',
    details: 'Logged into Admin Dashboard'
  },
  {
    id: 'AL-2',
    timestamp: new Date(Date.now() - 3600000 * 3).toISOString(),
    userId: 'u-2',
    userName: 'Alice Dispatcher',
    action: 'CREATE_JOB_CARD',
    details: 'Created Job Card JC-1001 with quantity 1200 KG'
  }
];

const defaultCompanyConfig: CompanyConfig = {
  companyName: 'Precision Metal Works',
  details: 'Specialists in high-tensile fasteners, engine components, and industrial finishes.',
  phone: '+91 98765 43210',
  address: 'Shed No. 12, Phase II, Industrial Area, Pune, MH, India',
  gstIn: '27AAAAA1111A1Z1',
  logoUrl: '',
  updatedBy: 'System Init',
  updatedAt: new Date().toISOString()
};


// Helper to load or initialize local storage collections
function getLocalStorageItem<T>(key: string, defaultValue: T): T {
  const item = localStorage.getItem(key);
  if (!item) {
    localStorage.setItem(key, JSON.stringify(defaultValue));
    return defaultValue;
  }
  try {
    return JSON.parse(item);
  } catch (e) {
    return defaultValue;
  }
}

function setLocalStorageItem<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
  // Emit state change event for active onSnapshot listeners
  window.dispatchEvent(new CustomEvent('mock-db-update', { detail: { collection: key } }));
}

// Unified API for direct retrieval (works for both modes, defaulting to local persistence during preview)
export class DBService {
  private static seedingPromise: Promise<void> | null = null;

  static async ensureSeeded(): Promise<void> {
    if (!useRealFirebase || !db) return;
    if (this.seedingPromise) return this.seedingPromise;

    this.seedingPromise = (async () => {
      try {
        const seededRef = doc(db, 'mfr_company_config', 'seeded');
        const snap = await getDoc(seededRef);
        if (snap.exists()) {
          return;
        }

        console.log("Database 'seeded' marker not found. Running one-time collection seeding...");
        
        // 1. Users
        const usersSnap = await getDocs(collection(db, 'mfr_users'));
        if (usersSnap.empty) {
          console.log("One-time seed: mfr_users");
          for (const u of defaultUsers) {
            await setDoc(doc(db, 'mfr_users', u.userId), u);
          }
        }

        // 2. Job Cards
        const jobsSnap = await getDocs(collection(db, 'mfr_job_cards'));
        if (jobsSnap.empty) {
          console.log("One-time seed: mfr_job_cards");
          for (const jc of defaultJobCards) {
            await setDoc(doc(db, 'mfr_job_cards', jc.jobCardNo), jc);
          }
        }

        // 3. Movements
        const movementsSnap = await getDocs(collection(db, 'mfr_movements'));
        if (movementsSnap.empty) {
          console.log("One-time seed: mfr_movements");
          for (const m of defaultMovements) {
            await setDoc(doc(db, 'mfr_movements', m.movementId), m);
          }
        }

        // 4. Notifications
        const notificationsSnap = await getDocs(collection(db, 'mfr_notifications'));
        if (notificationsSnap.empty) {
          console.log("One-time seed: mfr_notifications");
          for (const n of defaultNotifications) {
            await setDoc(doc(db, 'mfr_notifications', n.notificationId), n);
          }
        }

        // 5. Audit logs
        const auditLogsSnap = await getDocs(collection(db, 'mfr_audit_logs'));
        if (auditLogsSnap.empty) {
          console.log("One-time seed: mfr_audit_logs");
          for (const l of defaultAuditLogs) {
            await setDoc(doc(db, 'mfr_audit_logs', l.id), l);
          }
        }

        // 6. Global Company Config
        const globalRef = doc(db, 'mfr_company_config', 'global');
        const globalSnap = await getDoc(globalRef);
        if (!globalSnap.exists()) {
          console.log("One-time seed: mfr_company_config/global");
          await setDoc(globalRef, defaultCompanyConfig);
        }

        // Write the 'seeded' flag
        await setDoc(seededRef, { companyName: 'SystemSeeded', details: 'Initialized' } as CompanyConfig);
        console.log("Seeding process completed cleanly.");
      } catch (err) {
        console.warn("Seeding process bypassed or deferred due to network/permissions:", err);
      }
    })();

    return this.seedingPromise;
  }

  // Shared helper to fetch a single job card for Sheets syncing
  private static async getJobCardByNo(jobCardNo: string): Promise<JobCard | null> {
    if (useRealFirebase && db) {
      try {
        const snap = await getDoc(doc(db, 'mfr_job_cards', jobCardNo.toUpperCase()));
        return snap.exists() ? (snap.data() as JobCard) : null;
      } catch (err) {
        return null;
      }
    }
    const cards = await this.getJobCards();
    return cards.find(c => c.jobCardNo.toLowerCase() === jobCardNo.toLowerCase()) || null;
  }

  // Refactor Sheets trigger to a shared helper for clarity
  private static triggerSheetsSync(jobCardNo: string, updates: Partial<JobCard>, userName: string) {
    if (updates.heatTreatmentDetails) {
      logDepartmentUpdateToSheets(jobCardNo, 'Heat Treatment', userName, {
        hardnessSpec: updates.heatTreatmentDetails.hardnessRequired,
        tempPlating: updates.heatTreatmentDetails.temperature,
        cycleCoating: updates.heatTreatmentDetails.cycleTime,
        rejectionQty: updates.heatTreatmentDetails.rejectionQty,
        remarks: updates.heatTreatmentDetails.remarks,
        qtyReceivedFromProd: updates.heatTreatmentDetails.qtyReceivedFromProd,
        qtySentToPlating: updates.heatTreatmentDetails.qtySentToPlating,
        qtyRemainingAtProd: updates.heatTreatmentDetails.qtyRemaining
      }).catch(e => console.warn(e));
    }
    if (updates.platingDetails) {
      logDepartmentUpdateToSheets(jobCardNo, 'Plating', userName, {
        tempPlating: updates.platingDetails.platingType,
        cycleCoating: updates.platingDetails.micronThickness,
        styleInvoice: updates.platingDetails.durationMinutes,
        rejectionQty: updates.platingDetails.rejectionQty,
        remarks: updates.platingDetails.remarks,
        qtyReceivedFromProd: updates.platingDetails.qtyReceivedFromHt,
        qtySentToPlating: updates.platingDetails.qtySentToPacking,
        qtyRemainingAtProd: updates.platingDetails.qtyRemaining
      }).catch(e => console.warn(e));
    }
    if (updates.packingDetails) {
      logDepartmentUpdateToSheets(jobCardNo, 'Packing', userName, {
        boxBin: String(updates.packingDetails.boxCount),
        styleInvoice: updates.packingDetails.packingType,
        rejectionQty: updates.packingDetails.rejectionQty,
        remarks: updates.packingDetails.remarks,
        qtyReceivedFromProd: updates.packingDetails.qtyReceivedFromPlating,
        qtySentToPlating: updates.packingDetails.qtySentToStore,
        qtyRemainingAtProd: updates.packingDetails.qtyRemaining
      }).catch(e => console.warn(e));
    }
    if (updates.storeDetails) {
      logDepartmentUpdateToSheets(jobCardNo, 'Store', userName, {
        boxBin: updates.storeDetails.locationBin,
        rejectionQty: updates.storeDetails.rejectionQty,
        remarks: updates.storeDetails.remarks,
        qtyReceivedFromProd: updates.storeDetails.qtyReceivedFromPacking,
        qtySentToPlating: updates.storeDetails.qtySentToDispatch,
        qtyRemainingAtProd: updates.storeDetails.qtyRemaining
      }).catch(e => console.warn(e));
    }
    if (updates.dispatchDetails) {
      logDepartmentUpdateToSheets(jobCardNo, 'Dispatch', userName, {
        styleInvoice: updates.dispatchDetails.invoiceNo,
        remarks: updates.dispatchDetails.remarks
      }).catch(e => console.warn(e));
    }
    this.getJobCardByNo(jobCardNo).then(card => {
      if (card) {
        logJobCardToSheets(card).catch(err => console.warn('Google Sheets job card log failed: ', err));
      }
    });
  }

  // --- USERS ---
  static async getUsers(): Promise<UserProfile[]> {
    if (useRealFirebase && db) {
      try {
        await this.ensureSeeded();
        const querySnapshot = await getDocs(collection(db, 'mfr_users'));
        const usersList: UserProfile[] = [];
        querySnapshot.forEach((docSnap) => {
          usersList.push(docSnap.data() as UserProfile);
        });
        return usersList;
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, 'mfr_users');
      }
    }
    return getLocalStorageItem<UserProfile[]>('mfr_users', defaultUsers);
  }

  static async saveUser(user: UserProfile): Promise<void> {
    // 1. Update Local Storage offline cache first
    const list = await this.getUsers();
    const idx = list.findIndex(u => u.userId === user.userId || u.pin === user.pin || (u.email && u.email === user.email));
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...user };
    } else {
      list.push(user);
    }
    setLocalStorageItem('mfr_users', list);

    // 2. Write to physical Firestore
    if (useRealFirebase && db) {
      try {
        await setDoc(doc(db, 'mfr_users', user.userId), user);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `mfr_users/${user.userId}`);
      }
    }

    await this.logAction(user.userId, user.name, 'UPDATE_USER', `Saved changes for user '${user.name}'`);
  }

  static async deleteUser(userId: string, operatorName: string, performerId: string, performerName: string): Promise<void> {
    // 1. Write to physical Firestore first
    if (useRealFirebase && db) {
      try {
        await deleteDoc(doc(db, 'mfr_users', userId));
      } catch (err: any) {
        handleFirestoreError(err, OperationType.DELETE, `mfr_users/${userId}`);
        const shouldThrow = err && (
          err.code === 'permission-denied' || 
          err.code === 'invalid-argument' || 
          (err.message && (
            err.message.toLowerCase().includes('permission') || 
            err.message.toLowerCase().includes('denied')
          ))
        );
        if (shouldThrow) {
          throw err;
        }
      }
    }

    // 2. Update Local Storage offline cache second
    const list = await this.getUsers();
    const newList = list.filter(u => u.userId !== userId);
    setLocalStorageItem('mfr_users', newList);

    await this.logAction(performerId, performerName, 'DELETE_USER', `Deleted user account '${operatorName}' (ID: ${userId})`);
  }

  // --- JOB CARDS ---
  static async getJobCards(): Promise<JobCard[]> {
    if (useRealFirebase && db) {
      try {
        await this.ensureSeeded();
        const querySnapshot = await getDocs(collection(db, 'mfr_job_cards'));
        const cards: JobCard[] = [];
        querySnapshot.forEach((docSnap) => {
          cards.push(docSnap.data() as JobCard);
        });
        const sorted = cards.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        // Mirror to local cache on successful load
        setLocalStorageItem('mfr_job_cards', sorted);
        return sorted;
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, 'mfr_job_cards');
      }
    }
    return getLocalStorageItem<JobCard[]>('mfr_job_cards', defaultJobCards);
  }

  static async createJobCard(job: Omit<JobCard, 'jobCardNo' | 'orderNo' | 'createdAt' | 'completed' | 'balanceQty'>, creatorId: string, creatorName: string): Promise<JobCard> {
    const cards = await this.getJobCards();
    
    // Auto-generate sequentially
    const currentMaxNo = cards.reduce((acc, card) => {
      const parts = card.jobCardNo.split('-');
      const num = parts.length > 1 ? parseInt(parts[1]) : 1000;
      return !isNaN(num) && num > acc ? num : acc;
    }, 1000);
    const newNo = currentMaxNo + 1;
    
    const jobCardNo = `JC-${newNo}`;
    const orderNo = `ORD-${5000 + (newNo - 1000)}`;
    
    const newJob: JobCard = {
      ...job,
      createdBy: creatorName,
      jobCardNo,
      orderNo,
      balanceQty: job.orderQty, // initially complete orderQty
      createdAt: new Date().toISOString(),
      completed: false
    };

    // 1. Update Local Storage offline cache first
    cards.unshift(newJob);
    setLocalStorageItem('mfr_job_cards', cards);
    
    // Send notifications to Production
    await this.createNotification({
      department: 'Production',
      title: 'New Production Queue Item',
      message: `Job Card ${jobCardNo} generated for ${job.partyName}. Quantity: ${job.orderQty} KG.`,
      userId: 'all_production'
    });

    // 2. Write to physical Firestore
    if (useRealFirebase && db) {
      try {
        await setDoc(doc(db, 'mfr_job_cards', jobCardNo), newJob);
      } catch (err: any) {
        handleFirestoreError(err, OperationType.WRITE, `mfr_job_cards/${jobCardNo}`);
        const shouldThrow = err && (
          err.code === 'permission-denied' || 
          err.code === 'invalid-argument' || 
          (err.message && (
            err.message.toLowerCase().includes('permission') || 
            err.message.toLowerCase().includes('denied')
          ))
        );
        if (shouldThrow) {
          throw err;
        }
      }
    }

    await this.logAction(creatorId, creatorName, 'CREATE_JOB_CARD', `Generated job card ${jobCardNo} for ${job.partyName} (${job.orderQty} KG)`);
    
    // Log to Google Sheets
    logJobCardToSheets(newJob).catch(err => console.warn('Google Sheets log failed: ', err));

    return newJob;
  }

  static async updateJobCard(jobCardNo: string, updates: Partial<JobCard>, userId: string, userName: string): Promise<void> {
    // 1. Update Local Storage offline cache first
    const cards = await this.getJobCards();
    const idx = cards.findIndex(c => c.jobCardNo.toLowerCase() === jobCardNo.toLowerCase());
    if (idx === -1) throw new Error(`Job card ${jobCardNo} not found`);
    
    cards[idx] = { ...cards[idx], ...updates } as JobCard;
    setLocalStorageItem('mfr_job_cards', cards);

    // 2. Write to physical Firestore
    if (useRealFirebase && db) {
      try {
        await updateDoc(doc(db, 'mfr_job_cards', jobCardNo.toUpperCase()), updates as any);
      } catch (err: any) {
        handleFirestoreError(err, OperationType.UPDATE, `mfr_job_cards/${jobCardNo.toUpperCase()}`);
        const shouldThrow = err && (
          err.code === 'permission-denied' || 
          err.code === 'invalid-argument' || 
          (err.message && (
            err.message.toLowerCase().includes('permission') || 
            err.message.toLowerCase().includes('denied')
          ))
        );
        if (shouldThrow) {
          throw err;
        }
      }
    }

    await this.logAction(userId, userName, 'UPDATE_JOB_CARD', `Updated Job Card ${jobCardNo}. Status: ${updates.status || cards[idx].status}`);
    
    // Check if total rejection quantity for the job card exceeds 10% of total order quantity
    try {
      const updatedCard = cards[idx];
      const totalRejections = (updatedCard.heatTreatmentDetails?.rejectionQty || 0) +
                              (updatedCard.platingDetails?.rejectionQty || 0) +
                              (updatedCard.packingDetails?.rejectionQty || 0) +
                              (updatedCard.storeDetails?.rejectionQty || 0);
      const orderQty = updatedCard.orderQty || 0;
      if (orderQty > 0 && totalRejections > orderQty * 0.10) {
        const currentNotifications = await this.getNotifications();
        const alreadyNotified = currentNotifications.some(n => 
          n.department === 'Production' &&
          n.title.includes('High Rejection') &&
          n.message.includes(jobCardNo)
        );
        if (!alreadyNotified) {
          await this.createNotification({
            department: 'Production',
            title: '⚠️ High Rejection Rate Alert',
            message: `Job Card ${jobCardNo} (${updatedCard.itemName}) has exceeded 10% rejection threshold. Total Rejections: ${totalRejections} KG / Order Qty: ${orderQty} KG (${((totalRejections / orderQty) * 100).toFixed(1)}%).`,
            userId: 'all_production'
          });
        }
      }
    } catch (e) {
      console.error("Error creating rejection rate alert", e);
    }

    this.triggerSheetsSync(jobCardNo, updates, userName);
  }

  static async deleteJobCard(jobCardNo: string, userId: string, userName: string): Promise<void> {
    // 1. Write to physical Firestore first
    if (useRealFirebase && db) {
      try {
        await deleteDoc(doc(db, 'mfr_job_cards', jobCardNo.toUpperCase()));
      } catch (err: any) {
        handleFirestoreError(err, OperationType.DELETE, `mfr_job_cards/${jobCardNo.toUpperCase()}`);
        const shouldThrow = err && (
          err.code === 'permission-denied' || 
          err.code === 'invalid-argument' || 
          (err.message && (
            err.message.toLowerCase().includes('permission') || 
            err.message.toLowerCase().includes('denied')
          ))
        );
        if (shouldThrow) {
          throw err;
        }
      }
    }

    // 2. Update Local Storage offline cache second
    const cards = await this.getJobCards();
    const updatedCards = cards.filter(c => c.jobCardNo.toLowerCase() !== jobCardNo.toLowerCase());
    setLocalStorageItem('mfr_job_cards', updatedCards);

    await this.logAction(userId, userName, 'DELETE_JOB_CARD', `Deleted Job Card: ${jobCardNo}`);
  }

  static async deleteAllJobCards(userId: string, userName: string): Promise<void> {
    // 1. Update Local Storage offline cache first
    setLocalStorageItem('mfr_job_cards', []);

    // 2. Write to physical Firestore
    if (useRealFirebase && db) {
      try {
        const querySnapshot = await getDocs(collection(db, 'mfr_job_cards'));
        for (const docSnap of querySnapshot.docs) {
          await deleteDoc(doc(db, 'mfr_job_cards', docSnap.id));
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, 'mfr_job_cards');
      }
    }

    await this.logAction(userId, userName, 'DELETE_ALL_JOB_CARDS', `Deleted all job card entries from database`);
  }

  // --- MATERIAL MOVEMENTS ---
  static async getMovements(): Promise<MaterialMovement[]> {
    if (useRealFirebase && db) {
      try {
        await this.ensureSeeded();
        const querySnapshot = await getDocs(collection(db, 'mfr_movements'));
        const list: MaterialMovement[] = [];
        querySnapshot.forEach((docSnap) => {
          list.push(docSnap.data() as MaterialMovement);
        });
        const sorted = list.sort((a, b) => new Date(b.transferDate).getTime() - new Date(a.transferDate).getTime());
        // Mirror to local cache on successful load
        setLocalStorageItem('mfr_movements', sorted);
        return sorted;
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, 'mfr_movements');
      }
    }
    return getLocalStorageItem<MaterialMovement[]>('mfr_movements', defaultMovements);
  }

  static async createMovement(movement: Omit<MaterialMovement, 'movementId' | 'transferDate' | 'accepted'>, userId: string, userName: string): Promise<MaterialMovement> {
    const movements = await this.getMovements();
    const newId = `M-${2000 + movements.length + 1}`;
    
    const newMov: MaterialMovement = {
      ...movement,
      transferBy: movement.transferBy || userName || 'Staff',
      movementId: newId,
      transferDate: new Date().toISOString(),
      accepted: false
    };

    // 1. Update Local Storage offline cache first
    movements.unshift(newMov);
    setLocalStorageItem('mfr_movements', movements);
    
    // Update Job Card department & status to show pending placement
    await this.updateJobCard(movement.jobCardNo, {
      status: 'Pending Acceptance',
      currentDepartment: movement.toDepartment as Department
    }, userId, userName);

    // Create Notification for the receiving department
    await this.createNotification({
      department: movement.toDepartment === 'Completed' ? 'Dispatch' : (movement.toDepartment as Department),
      title: 'Material Sent',
      message: `Job Card ${movement.jobCardNo}: ${movement.quantity} KG transferred from ${movement.fromDepartment} to ${movement.toDepartment}.`,
      userId: `all_${movement.toDepartment.toLowerCase().replace(' ', '_')}`
    });

    // 2. Write to physical Firestore
    if (useRealFirebase && db) {
      try {
        await setDoc(doc(db, 'mfr_movements', newId), newMov);
      } catch (err: any) {
        handleFirestoreError(err, OperationType.WRITE, `mfr_movements/${newId}`);
        const shouldThrow = err && (
          err.code === 'permission-denied' || 
          err.code === 'invalid-argument' || 
          (err.message && (
            err.message.toLowerCase().includes('permission') || 
            err.message.toLowerCase().includes('denied')
          ))
        );
        if (shouldThrow) {
          throw err;
        }
      }
    }

    await this.logAction(userId, userName, 'TRANSFER_MATERIAL', `Transferred ${movement.quantity} KG of ${movement.jobCardNo} to ${movement.toDepartment}`);
    
    // Log to Google Sheets
    logMaterialMovementToSheets(newMov).catch(err => console.warn('Google Sheets movement log failed:', err));

    return newMov;
  }

  static async acceptMovement(movementId: string, acceptedByUserId: string, acceptedByName: string, remarks?: string): Promise<void> {
    const list = await this.getMovements();
    const idx = list.findIndex(m => m.movementId === movementId);
    if (idx === -1) throw new Error(`Movement ${movementId} not found`);
    const mov = list[idx];

    mov.accepted = true;
    mov.acceptedBy = acceptedByName;
    mov.acceptedDate = new Date().toISOString();
    if (remarks) mov.remarks = remarks;

    // 1. Update Local Storage offline cache first
    setLocalStorageItem('mfr_movements', list);

    // 2. Write to physical Firestore
    if (useRealFirebase && db) {
      try {
        await setDoc(doc(db, 'mfr_movements', movementId), mov);
      } catch (err: any) {
        handleFirestoreError(err, OperationType.WRITE, `mfr_movements/${movementId}`);
        const shouldThrow = err && (
          err.code === 'permission-denied' || 
          err.code === 'invalid-argument' || 
          (err.message && (
            err.message.toLowerCase().includes('permission') || 
            err.message.toLowerCase().includes('denied')
          ))
        );
        if (shouldThrow) {
          throw err;
        }
      }
    }

    // Update the corresponding job card status
    // If sent to 'Completed', process job card closure
    if (mov.toDepartment === 'Completed') {
      const cards = await this.getJobCards();
      const cardIdx = cards.findIndex(c => c.jobCardNo.toLowerCase() === mov!.jobCardNo.toLowerCase());
      if (cardIdx >= 0) {
        const card = cards[cardIdx];
        const newBalance = Math.max(0, card.orderQty - mov!.quantity);
        await this.updateJobCard(mov!.jobCardNo, {
          status: 'Completed',
          completed: true,
          currentQty: mov!.quantity,
          balanceQty: newBalance
        }, acceptedByUserId, acceptedByName);
        
        await this.createNotification({
          department: 'Dispatch',
          title: 'Dispatch Completed',
          message: `Job ${mov!.jobCardNo} is fully completed with Final Dispatched Quantity of ${mov!.quantity} KG (Balance: ${newBalance} KG).`,
          userId: 'all_dispatch'
        });
      }
    } else {
      // Set to in-process inside the target department
      await this.updateJobCard(mov.jobCardNo, {
        status: 'In Process',
        currentDepartment: mov.toDepartment as Department,
        currentQty: mov.quantity // update quantity to the accepted batch
      }, acceptedByUserId, acceptedByName);

      await this.createNotification({
        department: mov.fromDepartment,
        title: 'Material Accepted',
        message: `${acceptedByName} accepted ${mov.quantity} KG for Job Card ${mov.jobCardNo} at ${mov.toDepartment}.`,
        userId: 'previous_dept'
      });
    }

    await this.logAction(acceptedByUserId, acceptedByName, 'ACCEPT_MATERIAL', `Accepted transfer of ${mov.quantity} KG for ${mov.jobCardNo}`);
    
    // Log to Google Sheets
    logMaterialMovementToSheets(mov).catch(err => console.warn('Google Sheets movement log failed:', err));
  }

  static async rejectMovement(movementId: string, rejectedByUserId: string, rejectedByName: string, remarks: string): Promise<void> {
    // 1. Remove from Local Storage list first
    const list = await this.getMovements();
    const idx = list.findIndex(m => m.movementId === movementId);
    if (idx === -1) throw new Error(`Movement ${movementId} not found`);
    const mov = list[idx];
    list.splice(idx, 1);
    setLocalStorageItem('mfr_movements', list);

    // 2. Write to physical Firestore
    if (useRealFirebase && db) {
      try {
        await deleteDoc(doc(db, 'mfr_movements', movementId));
      } catch (err: any) {
        handleFirestoreError(err, OperationType.DELETE, `mfr_movements/${movementId}`);
        const shouldThrow = err && (
          err.code === 'permission-denied' || 
          err.code === 'invalid-argument' || 
          (err.message && (
            err.message.toLowerCase().includes('permission') || 
            err.message.toLowerCase().includes('denied')
          ))
        );
        if (shouldThrow) {
          throw err;
        }
      }
    }

    // Revert Job Card department to previous and mark status 'Rejected'
    await this.updateJobCard(mov.jobCardNo, {
      status: 'Rejected',
      currentDepartment: mov.fromDepartment
    }, rejectedByUserId, rejectedByName);

    // Create alarm notification for sender
    await this.createNotification({
      department: mov.fromDepartment,
      title: '⚠️ Material Rejected',
      message: `${rejectedByName} rejected Job Card ${mov.jobCardNo} movement. Remarks: "${remarks}"`,
      userId: `all_${mov.fromDepartment.toLowerCase().replace(' ', '_')}`
    });

    await this.logAction(rejectedByUserId, rejectedByName, 'REJECT_MATERIAL', `Rejected ${mov.quantity} KG for ${mov.jobCardNo}. Reason: ${remarks}`);
    
    // Log to Google Sheets
    logMaterialMovementToSheets({
      ...mov,
      accepted: false,
      remarks: `REJECTED: ${remarks}`
    }).catch(err => console.warn('Google Sheets movement log failed:', err));
  }

  // --- NOTIFICATIONS ---
  static async getNotifications(): Promise<AppNotification[]> {
    if (useRealFirebase && db) {
      try {
        await this.ensureSeeded();
        const querySnapshot = await getDocs(collection(db, 'mfr_notifications'));
        const list: AppNotification[] = [];
        querySnapshot.forEach((docSnap) => {
          list.push(docSnap.data() as AppNotification);
        });
        const sorted = list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        // Mirror to local cache on successful load
        setLocalStorageItem('mfr_notifications', sorted);
        return sorted;
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, 'mfr_notifications');
      }
    }
    return getLocalStorageItem<AppNotification[]>('mfr_notifications', defaultNotifications);
  }

  static async createNotification(notif: Omit<AppNotification, 'notificationId' | 'read' | 'createdAt'>): Promise<AppNotification> {
    const list = await this.getNotifications();
    const newId = `N-${3000 + list.length + 1}`;
    const newNotif: AppNotification = {
      ...notif,
      notificationId: newId,
      read: false,
      createdAt: new Date().toISOString()
    };

    // 1. Update Local Storage offline cache first
    list.unshift(newNotif);
    setLocalStorageItem('mfr_notifications', list);

    // 2. Write to physical Firestore
    if (useRealFirebase && db) {
      try {
        await setDoc(doc(db, 'mfr_notifications', newId), newNotif);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `mfr_notifications/${newId}`);
      }
    }

    return newNotif;
  }

  static async markNotificationRead(id: string): Promise<void> {
    // 1. Update Local Storage offline cache first
    const list = await this.getNotifications();
    const idx = list.findIndex(n => n.notificationId === id);
    if (idx >= 0) {
      list[idx].read = true;
      setLocalStorageItem('mfr_notifications', list);
    }

    // 2. Write to physical Firestore
    if (useRealFirebase && db) {
      try {
        await updateDoc(doc(db, 'mfr_notifications', id), { read: true });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `mfr_notifications/${id}`);
      }
    }
  }

  static async markAllNotificationsRead(department: Department | 'Admin' | 'All'): Promise<void> {
    // 1. Update Local Storage offline cache first
    const list = await this.getNotifications();
    const updated = list.map(n => {
      if (n.department === department || department === 'All') {
        return { ...n, read: true };
      }
      return n;
    });
    setLocalStorageItem('mfr_notifications', updated);

    // 2. Write to physical Firestore
    if (useRealFirebase && db) {
      try {
        for (const n of list) {
          if ((n.department === department || department === 'All') && !n.read) {
            await updateDoc(doc(db, 'mfr_notifications', n.notificationId), { read: true });
          }
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, 'mfr_notifications');
      }
    }
  }

  // --- AUDIT LOGS ---
  static async getAuditLogs(): Promise<AuditLog[]> {
    if (useRealFirebase && db) {
      try {
        await this.ensureSeeded();
        const querySnapshot = await getDocs(collection(db, 'mfr_audit_logs'));
        const list: AuditLog[] = [];
        querySnapshot.forEach((docSnap) => {
          list.push(docSnap.data() as AuditLog);
        });
        return list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 500);
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, 'mfr_audit_logs');
      }
    }
    return getLocalStorageItem<AuditLog[]>('mfr_audit_logs', defaultAuditLogs);
  }

  static async logAction(userId: string, userName: string, action: string, details: string): Promise<void> {
    const logs = await this.getAuditLogs();
    const newId = `AL-${logs.length + 1}-${Date.now()}`;
    const newLog: AuditLog = {
      id: newId,
      timestamp: new Date().toISOString(),
      userId,
      userName,
      action,
      details
    };

    if (useRealFirebase && db) {
      try {
        await setDoc(doc(db, 'mfr_audit_logs', newId), newLog);
        logActionToSheets(newLog).catch(err => console.warn('Google Sheets action log failed:', err));
        return;
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `mfr_audit_logs/${newId}`);
      }
    }

    logs.unshift(newLog);
    setLocalStorageItem('mfr_audit_logs', logs.slice(0, 500)); // keep last 500 logs
    
    // Log to Google Sheets
    logActionToSheets(newLog).catch(err => console.warn('Google Sheets action log failed:', err));
  }

  // --- COMPANY CONFIG ---
  static async getCompanyConfig(): Promise<CompanyConfig> {
    if (useRealFirebase && db) {
      try {
        await this.ensureSeeded();
        const docRef = doc(db, 'mfr_company_config', 'global');
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          return snap.data() as CompanyConfig;
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, 'mfr_company_config/global');
      }
    }
    return getLocalStorageItem<CompanyConfig>('mfr_company_config', defaultCompanyConfig);
  }

  static async saveCompanyConfig(config: CompanyConfig, userId: string, userName: string): Promise<void> {
    if (useRealFirebase && db) {
      try {
        await setDoc(doc(db, 'mfr_company_config', 'global'), config);
        await this.logAction(userId, userName, 'UPDATE_COMPANY_CONFIG', `Updated Company details to: ${config.companyName}`);
        return;
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, 'mfr_company_config/global');
      }
    }
    setLocalStorageItem('mfr_company_config', config);
    await this.logAction(userId, userName, 'UPDATE_COMPANY_CONFIG', `Updated Company details to: ${config.companyName}`);
  }

  // Realtime subscription emulation & Live Firestore triggers
  static subscribeToUpdates(collectionName: string, callback: () => void): () => void {
    if (useRealFirebase && db) {
      try {
        const unsub = onSnapshot(collection(db, collectionName), () => {
          callback();
        }, (err) => {
          console.error(`Firestore watch failed for collection [${collectionName}]: `, err);
        });
        return unsub;
      } catch (err) {
        console.error(`Failed to register Firestore real-time listener for ${collectionName}:`, err);
      }
    }

    const handler = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail && customEvent.detail.collection === collectionName) {
        callback();
      }
    };
    window.addEventListener('mock-db-update', handler);
    return () => {
      window.removeEventListener('mock-db-update', handler);
    };
  }
}
