import { CommercialRecord, DuplicateRequest, User, Role, CommercialType, CITIES as DEFAULT_CITIES } from '../types';

const DB_NAME = 'MinutesMasterDB';
const DB_VERSION = 1;

// Store Names
const STORE_RECORDS = 'records';
const STORE_REQUESTS = 'requests';
const STORE_BIN = 'bin';
const STORE_USERS = 'users';
const STORE_CONFIG = 'config';

const STORAGE_KEYS_LEGACY = {
  USERS: 'mm_users',
  RECORDS: 'mm_records',
  REQUESTS: 'mm_requests',
  BIN: 'mm_bin',
  CITIES: 'mm_cities'
};

// Seed Data
const SEED_USERS: User[] = [
  { id: '1', employeeId: 'maker1', name: 'Maker', role: Role.MAKER },
  { id: '2', employeeId: 'checker1', name: 'Checker', role: Role.CHECKER, pin: '1234' },
];

type RecordListener = (records: CommercialRecord[]) => void;
type CityListener = (cities: string[]) => void;

class DBService {
  private dbPromise: Promise<IDBDatabase> | null = null;
  private listeners: RecordListener[] = [];
  private cityListeners: CityListener[] = [];

  constructor() {
    this.init();
  }

  // --- IndexedDB Core Wrappers ---

  private async getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        if (!db.objectStoreNames.contains(STORE_RECORDS)) {
          db.createObjectStore(STORE_RECORDS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_REQUESTS)) {
          db.createObjectStore(STORE_REQUESTS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_BIN)) {
          // Bin needs to allow multiple deleted versions, so we use autoIncrement
          db.createObjectStore(STORE_BIN, { keyPath: 'binId', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains(STORE_USERS)) {
          db.createObjectStore(STORE_USERS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_CONFIG)) {
          db.createObjectStore(STORE_CONFIG, { keyPath: 'key' });
        }
      };

      request.onsuccess = (event) => {
        resolve((event.target as IDBOpenDBRequest).result);
      };

      request.onerror = (event) => {
        console.error("IDB Open Error:", (event.target as IDBOpenDBRequest).error);
        reject((event.target as IDBOpenDBRequest).error);
      };
    });

    return this.dbPromise;
  }

  private async transaction<T>(
    storeNames: string | string[], 
    mode: IDBTransactionMode, 
    callback: (store: IDBObjectStore) => IDBRequest<T> | void
  ): Promise<T> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeNames, mode);
      const store = tx.objectStore(Array.isArray(storeNames) ? storeNames[0] : storeNames);
      
      let req: IDBRequest | void;
      try {
        req = callback(store);
      } catch (e) {
        reject(e);
        return;
      }

      tx.oncomplete = () => {
        resolve(req ? req.result : undefined);
      };
      tx.onerror = () => reject(tx.error);
    });
  }

  private async getAll<T>(storeName: string): Promise<T[]> {
    return this.transaction(storeName, 'readonly', (store) => store.getAll());
  }

  private async get<T>(storeName: string, key: string): Promise<T | undefined> {
    return this.transaction(storeName, 'readonly', (store) => store.get(key));
  }

  private async put(storeName: string, value: any): Promise<void> {
    await this.transaction(storeName, 'readwrite', (store) => store.put(value));
  }

  private async bulkPut(storeName: string, values: any[]): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      
      values.forEach(v => store.put(v));
      
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  private async delete(storeName: string, key: string | number): Promise<void> {
    await this.transaction(storeName, 'readwrite', (store) => store.delete(key));
  }

  private async bulkDelete(storeName: string, keys: string[]): Promise<void> {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        keys.forEach(k => store.delete(k));
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
  }

  private async clear(storeName: string): Promise<void> {
    await this.transaction(storeName, 'readwrite', (store) => store.clear());
  }

  // --- Initialization & Migration ---

  async init() {
    try {
        const db = await this.getDB();
        
        // 1. Check if we need to migrate from LocalStorage
        const legacyRecords = localStorage.getItem(STORAGE_KEYS_LEGACY.RECORDS);
        if (legacyRecords) {
            await this.migrateFromLocalStorage();
        } else {
            // 2. Check if we need to seed initial data (Users/Cities)
            const users = await this.getAll<User>(STORE_USERS);
            if (users.length === 0) {
                await this.bulkPut(STORE_USERS, SEED_USERS);
            }
            
            const cityConfig = await this.get<{key: string, value: string[]}>(STORE_CONFIG, 'cities');
            if (!cityConfig) {
                await this.put(STORE_CONFIG, { key: 'cities', value: DEFAULT_CITIES });
            }
        }
    } catch (e) {
        console.error("DB Init Failed", e);
    }
  }

  private async migrateFromLocalStorage() {
      console.log("Migrating from LocalStorage to IndexedDB...");
      try {
          // Records
          const records = JSON.parse(localStorage.getItem(STORAGE_KEYS_LEGACY.RECORDS) || '[]');
          if(records.length > 0) await this.bulkPut(STORE_RECORDS, records);
          
          // Users
          let users = JSON.parse(localStorage.getItem(STORAGE_KEYS_LEGACY.USERS) || '[]');
          if (users.length === 0) users = SEED_USERS;
          await this.bulkPut(STORE_USERS, users);

          // Requests
          const requests = JSON.parse(localStorage.getItem(STORAGE_KEYS_LEGACY.REQUESTS) || '[]');
          if(requests.length > 0) await this.bulkPut(STORE_REQUESTS, requests);

          // Bin
          const bin = JSON.parse(localStorage.getItem(STORAGE_KEYS_LEGACY.BIN) || '[]');
          // Bin items in legacy didn't have a binId, autoIncrement will handle it
          if(bin.length > 0) await this.bulkPut(STORE_BIN, bin);

          // Cities
          const cities = JSON.parse(localStorage.getItem(STORAGE_KEYS_LEGACY.CITIES) || JSON.stringify(DEFAULT_CITIES));
          await this.put(STORE_CONFIG, { key: 'cities', value: cities });

          // Cleanup LocalStorage
          localStorage.removeItem(STORAGE_KEYS_LEGACY.RECORDS);
          localStorage.removeItem(STORAGE_KEYS_LEGACY.REQUESTS);
          localStorage.removeItem(STORAGE_KEYS_LEGACY.BIN);
          localStorage.removeItem(STORAGE_KEYS_LEGACY.USERS); 
          localStorage.removeItem(STORAGE_KEYS_LEGACY.CITIES);
          
          console.log("Migration Complete.");
      } catch (e) {
          console.error("Migration Failed", e);
      }
  }

  // --- Public API ---

  // Subscriptions - Records
  subscribeToRecords(callback: RecordListener): () => void {
    this.listeners.push(callback);
    this.getRecords().then(records => callback(records));
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  private async notifyListeners() {
    const records = await this.getRecords();
    this.listeners.forEach(l => l(records));
  }

  // Subscriptions - Cities
  subscribeToCities(callback: CityListener): () => void {
    this.cityListeners.push(callback);
    this.getCities().then(c => callback(c));
    return () => {
      this.cityListeners = this.cityListeners.filter(l => l !== callback);
    };
  }

  private async notifyCityListeners() {
      const cities = await this.getCities();
      this.cityListeners.forEach(l => l(cities));
  }

  // Auth
  async login(employeeId: string): Promise<User | null> {
    const users = await this.getAll<User>(STORE_USERS);
    return users.find(u => u.employeeId === employeeId) || null;
  }

  async verifyPin(userId: string, pin: string): Promise<boolean> {
    const user = await this.get<User>(STORE_USERS, userId);
    return user ? user.pin === pin : false;
  }

  // Cities
  async getCities(): Promise<string[]> {
    const config = await this.get<{key: string, value: string[]}>(STORE_CONFIG, 'cities');
    return config ? config.value : DEFAULT_CITIES;
  }

  async addCity(city: string): Promise<void> {
    const cities = await this.getCities();
    if (!cities.includes(city)) {
      cities.push(city);
      await this.put(STORE_CONFIG, { key: 'cities', value: cities });
      this.notifyCityListeners();
    }
  }

  async deleteCity(city: string): Promise<void> {
    const cities = await this.getCities();
    const updated = cities.filter(c => c !== city);
    await this.put(STORE_CONFIG, { key: 'cities', value: updated });
    this.notifyCityListeners();
  }

  // Records
  async getRecords(): Promise<CommercialRecord[]> {
    return this.getAll<CommercialRecord>(STORE_RECORDS);
  }

  async addRecords(records: CommercialRecord[]): Promise<void> {
    await this.bulkPut(STORE_RECORDS, records);
    await this.notifyListeners();
  }

  async updateRecord(updatedRecord: CommercialRecord): Promise<void> {
    await this.put(STORE_RECORDS, updatedRecord);
    await this.notifyListeners();
  }

  async updateRecords(updatedRecords: CommercialRecord[]): Promise<void> {
    await this.bulkPut(STORE_RECORDS, updatedRecords);
    await this.notifyListeners();
  }

  async deleteRecord(recordId: string, movedToBinBy: string): Promise<void> {
      await this.delete(STORE_RECORDS, recordId);
      await this.notifyListeners();
  }

  async deleteRecords(recordIds: string[], movedToBinBy: string): Promise<void> {
      if (recordIds.length === 0) return;
      
      await this.bulkDelete(STORE_RECORDS, recordIds);
      await this.notifyListeners();
  }

  async getBinRecords(): Promise<any[]> {
    return this.getAll(STORE_BIN);
  }

  async clearAllRecords(clearedBy: string): Promise<void> {
    // Perform writes in a single transaction (Write)
    const db = await this.getDB();
    
    return new Promise((resolve, reject) => {
        const tx = db.transaction([STORE_RECORDS, STORE_REQUESTS], 'readwrite');
        const recordStore = tx.objectStore(STORE_RECORDS);
        const reqStore = tx.objectStore(STORE_REQUESTS);

        // Clear Stores
        recordStore.clear();
        reqStore.clear();

        tx.oncomplete = () => {
            this.notifyListeners();
            resolve();
        };
        
        tx.onerror = (e) => {
            console.error("Clear Transaction Failed", tx.error);
            reject(tx.error);
        };
    });
  }

  // Requests
  async getDuplicateRequests(): Promise<DuplicateRequest[]> {
    return this.getAll<DuplicateRequest>(STORE_REQUESTS);
  }

  async createDuplicateRequest(request: DuplicateRequest): Promise<void> {
    await this.put(STORE_REQUESTS, request);
  }

  async createDuplicateRequests(requests: DuplicateRequest[]): Promise<void> {
    await this.bulkPut(STORE_REQUESTS, requests);
  }

  async resolveDuplicateRequest(requestId: string, status: 'APPROVED' | 'REJECTED', resolverId: string): Promise<void> {
    const request = await this.get<DuplicateRequest>(STORE_REQUESTS, requestId);
    if (!request) return;

    request.status = status;
    await this.put(STORE_REQUESTS, request); // Update status

    if (status === 'APPROVED') {
        const newRec = request.payload;
        const allRecords = await this.getRecords();
        const isInvoice = newRec.type === CommercialType.ON_INVOICE || newRec.type === CommercialType.OFF_INVOICE;
        
        // Find Conflicts
        let idsToDelete: string[] = [];

        if (isInvoice) {
            idsToDelete = allRecords.filter(r => 
                r.fsn === newRec.fsn &&
                r.city === newRec.city &&
                r.type === newRec.type &&
                r.startDate === newRec.startDate &&
                r.endDate === newRec.endDate
            ).map(r => r.id);
        } else {
             idsToDelete = allRecords.filter(r => 
                r.fsn === newRec.fsn &&
                r.city === newRec.city &&
                r.type === newRec.type &&
                (newRec.startDate <= r.endDate && newRec.endDate >= r.startDate)
            ).map(r => r.id);
        }

        if (idsToDelete.length > 0) {
            await this.deleteRecords(idsToDelete, resolverId);
        }
        await this.addRecords([newRec]);
    }
  }

  async resolveDuplicateRequestsBatch(requestIds: string[], status: 'APPROVED' | 'REJECTED', resolverId: string): Promise<void> {
    if (requestIds.length === 0) return;

    // 1. Update Requests Status
    const allRequests = await this.getAll<DuplicateRequest>(STORE_REQUESTS);
    const targetRequests = allRequests.filter(r => requestIds.includes(r.id));
    
    if (targetRequests.length === 0) return;

    const updatedRequests = targetRequests.map(r => ({ ...r, status }));
    await this.bulkPut(STORE_REQUESTS, updatedRequests);

    // 2. If Approved, process records
    if (status === 'APPROVED') {
        const allRecords = await this.getRecords();
        
        // Index records by FSN for performance O(N) -> O(1) lookup
        const recordsByFsn = new Map<string, CommercialRecord[]>();
        allRecords.forEach(r => {
            if (!recordsByFsn.has(r.fsn)) recordsByFsn.set(r.fsn, []);
            recordsByFsn.get(r.fsn)!.push(r);
        });

        const recordsToDelete = new Set<string>();
        const recordsToAdd: CommercialRecord[] = [];

        for (const req of targetRequests) {
            const newRec = req.payload;
            const candidates = recordsByFsn.get(newRec.fsn) || [];
            
            const isInvoice = newRec.type === CommercialType.ON_INVOICE || newRec.type === CommercialType.OFF_INVOICE;

            candidates.forEach(existing => {
                if (existing.city !== newRec.city) return;
                if (existing.type !== newRec.type) return;

                let isConflict = false;
                if (isInvoice) {
                    if (existing.startDate === newRec.startDate && existing.endDate === newRec.endDate) isConflict = true;
                } else {
                    // Overlap check
                    if (newRec.startDate <= existing.endDate && newRec.endDate >= existing.startDate) isConflict = true;
                }

                if (isConflict) {
                    recordsToDelete.add(existing.id);
                }
            });

            recordsToAdd.push(newRec);
        }

        if (recordsToDelete.size > 0) {
            await this.bulkDelete(STORE_RECORDS, Array.from(recordsToDelete));
        }
        if (recordsToAdd.length > 0) {
            await this.bulkPut(STORE_RECORDS, recordsToAdd);
        }
        
        await this.notifyListeners();
    }
  }
}

export const db = new DBService();