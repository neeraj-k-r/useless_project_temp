import { 
  collection, 
  doc, 
  setDoc, 
  addDoc, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  limit, 
  getDocs 
} from 'firebase/firestore';
import { ref, set as rtdbSet, onValue as rtdbOnValue } from 'firebase/database';
import { db, rtdb, isLiveFirebaseConfigured } from '../firebase/config';
import { 
  OutageReport, 
  OutageEvent, 
  TorchEvent, 
  ActivityItem, 
  ReportType 
} from '../types';
import { communityService } from './communityService';
import { authService } from './authService';
import { torchService } from '../torch/torchService';
import { sounds } from '../utils/sound';

const REPORTS_KEY = 'vt_reports_storage';
const OUTAGES_KEY = 'vt_outages_storage';
const TORCH_EVENTS_KEY = 'vt_torch_events_storage';
const ACTIVITIES_KEY = 'vt_activities_storage';

class OutageService {
  private reports: OutageReport[] = [];
  private outages: OutageEvent[] = [];
  private torchEvents: TorchEvent[] = [];
  private activities: ActivityItem[] = [];

  private reportListeners: Set<(reports: OutageReport[]) => void> = new Set();
  private activityListeners: Set<(activities: ActivityItem[]) => void> = new Set();
  private torchEventListeners: Set<(event: TorchEvent) => void> = new Set();
  private broadcastChannel: BroadcastChannel | null = null;
  private processedTorchEventIds: Set<string> = new Set();

  constructor() {
    this.loadInitialStorage();

    // Multi-window / Multi-tab sync channel
    if (typeof BroadcastChannel !== 'undefined') {
      this.broadcastChannel = new BroadcastChannel('velicham_outage_sync');
      this.broadcastChannel.onmessage = (event) => {
        if (!event.data) return;
        switch (event.data.type) {
          case 'NEW_REPORT':
            this.handleIncomingReport(event.data.payload, false);
            break;
          case 'NEW_ACTIVITY':
            this.handleIncomingActivity(event.data.payload, false);
            break;
          case 'TORCH_EVENT':
            this.handleIncomingTorchEvent(event.data.payload, false);
            break;
          case 'STATE_SYNC':
            this.reports = event.data.payload.reports;
            this.activities = event.data.payload.activities;
            this.torchEvents = event.data.payload.torchEvents;
            this.notifyAll();
            break;
        }
      };
    }

    // Cross-tab storage event listener
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key === 'vt_live_torch_signal' && e.newValue) {
          try {
            const data = JSON.parse(e.newValue);
            if (data?.event) {
              this.handleIncomingTorchEvent(data.event as TorchEvent, false);
            }
          } catch (err) {}
        }
      });
    }

    // Live Firebase Listeners
    if (isLiveFirebaseConfigured) {
      // 1. High-Speed Firebase Realtime Database Listener (<100ms)
      if (rtdb) {
        try {
          const torchSignalRef = ref(rtdb, 'torchSignal');
          rtdbOnValue(torchSignalRef, (snapshot) => {
            if (snapshot.exists()) {
              const data = snapshot.val();
              if (data && data.event) {
                const age = Math.abs(Date.now() - (data.timestamp || 0));
                if (age < 600000) { // 10 minute tolerance for device clock skew
                  this.handleIncomingTorchEvent(data.event as TorchEvent, false);
                }
              }
            }
          }, (err) => console.warn('RTDB torch signal listener error:', err));
        } catch (e) {
          console.warn('RTDB init error:', e);
        }
      }

      // 2. Firestore Single-Document Realtime Listener
      try {
        const signalDoc = doc(db, 'system', 'torchSignal');
        onSnapshot(signalDoc, (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            if (data && data.event) {
              const age = Math.abs(Date.now() - (data.timestamp || 0));
              if (age < 600000) {
                this.handleIncomingTorchEvent(data.event as TorchEvent, false);
              }
            }
          }
        }, (err) => console.warn('Torch signal listener error:', err));

        // Listen to torch events collection (last 10 min only — same window the handler enforces)
        const torchCol = collection(db, 'torchEvents');
        const recentTorchQ = query(
          torchCol,
          where('createdAt', '>=', Date.now() - 600000)
        );
        onSnapshot(recentTorchQ, (snap) => {
          snap.docChanges().forEach(change => {
            if (change.type === 'added') {
              const data = change.doc.data() as TorchEvent;
              if (data && Math.abs(Date.now() - (data.createdAt || 0)) < 600000) {
                this.handleIncomingTorchEvent(data, false);
              }
            }
          });
        });

        // Listen to reports
        const reportsCol = collection(db, 'reports');
        onSnapshot(reportsCol, (snap) => {
          const loaded: OutageReport[] = [];
          snap.forEach(d => loaded.push(d.data() as OutageReport));
          this.reports = loaded;
          this.notifyReports();
        });

        // Listen to activities
        const actCol = collection(db, 'activities');
        onSnapshot(actCol, (snap) => {
          const loaded: ActivityItem[] = [];
          snap.forEach(d => loaded.push(d.data() as ActivityItem));
          loaded.sort((a, b) => b.timestamp - a.timestamp);
          this.activities = loaded;
          this.notifyActivities();
        });
      } catch (e) {
        console.warn('Firestore live listener notice:', e);
      }
    }
  }

  private loadInitialStorage() {
    try {
      const r = localStorage.getItem(REPORTS_KEY);
      if (r) this.reports = JSON.parse(r);

      const a = localStorage.getItem(ACTIVITIES_KEY);
      if (a) this.activities = JSON.parse(a);

      const t = localStorage.getItem(TORCH_EVENTS_KEY);
      if (t) this.torchEvents = JSON.parse(t);
    } catch (e) {}
  }

  private saveStorage() {
    localStorage.setItem(REPORTS_KEY, JSON.stringify(this.reports));
    localStorage.setItem(ACTIVITIES_KEY, JSON.stringify(this.activities));
    localStorage.setItem(TORCH_EVENTS_KEY, JSON.stringify(this.torchEvents));
  }

  public subscribeReports(fn: (reports: OutageReport[]) => void): () => void {
    this.reportListeners.add(fn);
    fn(this.reports);
    return () => this.reportListeners.delete(fn);
  }

  public subscribeActivities(fn: (activities: ActivityItem[]) => void): () => void {
    this.activityListeners.add(fn);
    fn(this.activities);
    return () => this.activityListeners.delete(fn);
  }

  public subscribeTorchEvents(fn: (event: TorchEvent) => void): () => void {
    this.torchEventListeners.add(fn);
    return () => this.torchEventListeners.delete(fn);
  }

  private notifyReports() {
    this.saveStorage();
    this.reportListeners.forEach(fn => fn(this.reports));
  }

  private notifyActivities() {
    this.saveStorage();
    this.activityListeners.forEach(fn => fn(this.activities));
  }

  private notifyAll() {
    this.notifyReports();
    this.notifyActivities();
  }

  /**
   * Get active valid reports inside the sliding time window for a community
   */
  public getActiveReportsForCommunity(communityId: string, type: ReportType): OutageReport[] {
    const comm = communityService.getCommunity(communityId);
    const windowMs = (comm?.timeWindowMinutes || 5) * 60 * 1000;
    const now = Date.now();

    // Filter by community, type, and valid time window
    const validReports = this.reports.filter(r => 
      r.communityId === communityId &&
      r.type === type &&
      (now - r.createdAt) <= windowMs
    );

    // Return distinct users only (latest report per user)
    const distinctMap = new Map<string, OutageReport>();
    validReports.forEach(r => {
      if (!distinctMap.has(r.userId) || distinctMap.get(r.userId)!.createdAt < r.createdAt) {
        distinctMap.set(r.userId, r);
      }
    });

    return Array.from(distinctMap.values());
  }

  /**
   * Check if specific user already reported within the active window
   */
  public hasUserReportedRecently(userId: string, communityId: string, type: ReportType): boolean {
    const active = this.getActiveReportsForCommunity(communityId, type);
    return active.some(r => r.userId === userId);
  }

  /**
   * Check user's current active report status
   */
  public getUserActiveStatus(userId: string, communityId: string): ReportType | null {
    const comm = communityService.getCommunity(communityId);
    const windowMs = (comm?.timeWindowMinutes || 5) * 60 * 1000;
    const now = Date.now();

    const userReports = this.reports
      .filter(r => r.userId === userId && r.communityId === communityId && (now - r.createdAt) <= windowMs)
      .sort((a, b) => b.createdAt - a.createdAt);

    return userReports.length > 0 ? userReports[0].type : null;
  }

  /**
   * Submit CURRENT POYI report (Switches user status to Power Outage)
   */
  public async reportCurrentPoyi(userId: string, userName: string, communityId: string): Promise<{ success: boolean; message: string; verified: boolean }> {
    sounds.playReportClick();

    // Remove any previous active report from this user for this community to allow clean switching
    this.reports = this.reports.filter(r => !(r.userId === userId && r.communityId === communityId));

    const report: OutageReport = {
      id: 'rep_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      userId,
      userName,
      communityId,
      type: 'CURRENT_POYI',
      createdAt: Date.now()
    };

    await this.handleIncomingReport(report, true);

    const comm = communityService.getCommunity(communityId);
    const activity: ActivityItem = {
      id: 'act_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      timestamp: Date.now(),
      userName,
      type: 'REPORT_POYI',
      message: `${userName} reported CURRENT POYI in ${comm?.name || 'community'}`,
      communityId
    };
    // Check consensus based on percentage of registered users in the locality.
    // The threshold is floored at the community's configured outageThreshold
    // (default 3) so a single report can NEVER fire flashlights by itself —
    // the minimum number of distinct residents must confirm within the window.
    const activeReports = this.getActiveReportsForCommunity(communityId, 'CURRENT_POYI');
    const memberCount = Math.max(comm?.memberCount || 1, 1);
    const dynamicThreshold = memberCount <= 2 ? 1 : Math.max(2, Math.ceil(memberCount * 0.3));
    const threshold = Math.max(comm?.outageThreshold || 3, dynamicThreshold);

    if (activeReports.length >= threshold) {
      // Threshold reached -> AUTOMATICALLY TRIGGER FLASHLIGHT FOR ALL USERS IN THIS COMMUNITY!
      await this.verifyOutage(communityId, 'CONSENSUS', activeReports.length);
      return { 
        success: true, 
        message: `🔴 Power cut verified! (${activeReports.length}/${threshold} residents in ${comm?.name || 'area'}) Flashlights triggered automatically.`,
        verified: true 
      };
    } else {
      // Update community state to REPORTING
      await communityService.updateCommunityStatus(communityId, 'REPORTING', {
        activeReportsCount: activeReports.length,
        activeRestoresCount: 0
      });
      return { 
        success: true, 
        message: `🔴 CURRENT POYI recorded (${activeReports.length}/${threshold} confirmations to trigger flashlights)`,
        verified: false 
      };
    }
  }

  /**
   * Submit CURRENT VANNU report (Switches user status to Power Back)
   */
  public async reportCurrentVannu(userId: string, userName: string, communityId: string): Promise<{ success: boolean; message: string; restored: boolean }> {
    sounds.playReportClick();

    // Remove any previous active report from this user for this community to allow clean switching
    this.reports = this.reports.filter(r => !(r.userId === userId && r.communityId === communityId));

    const report: OutageReport = {
      id: 'rep_res_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      userId,
      userName,
      communityId,
      type: 'CURRENT_VANNU',
      createdAt: Date.now()
    };

    await this.handleIncomingReport(report, true);

    const comm = communityService.getCommunity(communityId);
    const activity: ActivityItem = {
      id: 'act_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      timestamp: Date.now(),
      userName,
      type: 'REPORT_VANNU',
      message: `${userName} reported CURRENT VANNU in ${comm?.name || 'community'}`,
      communityId
    };
    await this.handleIncomingActivity(activity, true);

    const activeOutages = this.getActiveReportsForCommunity(communityId, 'CURRENT_POYI');
    const restores = this.getActiveReportsForCommunity(communityId, 'CURRENT_VANNU');
    const memberCount = Math.max(comm?.memberCount || 1, 1);
    const dynamicRestore = memberCount <= 2 ? 1 : Math.max(1, Math.ceil(memberCount * 0.3));
    const restoreThreshold = Math.max(comm?.restoreThreshold || 2, dynamicRestore);

    if (activeOutages.length === 0 || restores.length >= restoreThreshold) {
      // AUTOMATICALLY TURN OFF FLASHLIGHTS FOR ALL USERS IN THIS COMMUNITY!
      await this.restorePower(communityId, 'CONSENSUS');
      return { 
        success: true, 
        message: '🟢 CURRENT VANNU verified! Flashlights turned OFF for all users.', 
        restored: true 
      };
    } else {
      await communityService.updateCommunityStatus(communityId, activeOutages.length >= (memberCount <= 2 ? 1 : 2) ? 'VERIFIED_OUTAGE' : 'REPORTING', {
        activeReportsCount: activeOutages.length,
        activeRestoresCount: restores.length
      });
      return { 
        success: true, 
        message: `🟢 CURRENT VANNU logged (${restores.length}/${restoreThreshold} to restore)`,
        restored: false 
      };
    }
  }

  /**
   * Transition community to VERIFIED_OUTAGE and trigger synchronized flashlight
   */
  public async verifyOutage(communityId: string, verifiedBy: 'CONSENSUS' | 'CONTROLLER', count: number = 3) {
    sounds.playOutageAlert();

    const comm = communityService.getCommunity(communityId);
    const now = Date.now();

    await communityService.updateCommunityStatus(communityId, 'VERIFIED_OUTAGE', {
      activeReportsCount: count,
      activeRestoresCount: 0,
      lastOutageVerifiedAt: now
    });

    // Add activity items
    const actVerify: ActivityItem = {
      id: 'act_' + now + '_v',
      timestamp: now,
      userName: verifiedBy === 'CONTROLLER' ? 'KSEB Controller' : 'Community Consensus',
      type: 'OUTAGE_VERIFIED',
      message: `🔴 Power outage confirmed in ${comm?.name || 'community'} (${count} confirmations)`,
      communityId
    };
    await this.handleIncomingActivity(actVerify, true);

    const actTorch: ActivityItem = {
      id: 'act_' + (now + 1) + '_t',
      timestamp: now + 1,
      userName: 'Velicham Signal',
      type: 'TORCH_ACTIVATED',
      message: `🔦 Velicham Tharaam flashlight signal activated!`,
      communityId
    };
    await this.handleIncomingActivity(actTorch, true);

    // Trigger Torch Event: BLINK_THEN_ON
    const torchEvent: TorchEvent = {
      id: 'torch_' + now + '_' + Math.random().toString(36).substring(2, 6),
      communityId,
      action: 'BLINK_THEN_ON',
      pattern: '3_BLINKS',
      createdAt: now,
      createdBy: verifiedBy
    };

    await this.handleIncomingTorchEvent(torchEvent, true);
  }

  /**
   * Restore power back to NORMAL and turn off torches
   */
  public async restorePower(communityId: string, verifiedBy: 'CONSENSUS' | 'CONTROLLER' = 'CONTROLLER') {
    sounds.playRestoreChime();

    const now = Date.now();
    const comm = communityService.getCommunity(communityId);

    // Clear reports for this community
    this.reports = this.reports.filter(r => r.communityId !== communityId);
    this.notifyReports();

    await communityService.updateCommunityStatus(communityId, 'NORMAL', {
      activeReportsCount: 0,
      activeRestoresCount: 0,
      lastRestoredAt: now
    });

    const actRestore: ActivityItem = {
      id: 'act_' + now + '_restored',
      timestamp: now,
      userName: verifiedBy === 'CONTROLLER' ? 'KSEB Controller' : 'Community Consensus',
      type: 'POWER_RESTORED',
      message: `🟢 Current thirichu vannu! Power restored in ${comm?.name || 'community'}.`,
      communityId
    };
    await this.handleIncomingActivity(actRestore, true);

    // Trigger Torch Event: TORCH_OFF
    const torchEvent: TorchEvent = {
      id: 'torch_off_' + now + '_' + Math.random().toString(36).substring(2, 6),
      communityId,
      action: 'TORCH_OFF',
      pattern: '3_BLINKS',
      createdAt: now,
      createdBy: verifiedBy
    };

    await this.handleIncomingTorchEvent(torchEvent, true);
  }

  /**
   * Controller: Trigger Flashlight for a specific community
   */
  public async controllerTriggerTorch(communityId: string) {
    const now = Date.now();
    const torchEvent: TorchEvent = {
      id: 'torch_ctrl_' + now + '_' + Math.random().toString(36).substring(2, 6),
      communityId,
      action: 'BLINK_THEN_ON',
      pattern: '3_BLINKS',
      createdAt: now,
      createdBy: 'CONTROLLER'
    };
    await this.handleIncomingTorchEvent(torchEvent, true);
  }

  /**
   * Controller: Turn OFF Flashlight for a specific community
   */
  public async controllerDeactivateTorch(communityId: string) {
    const now = Date.now();
    const torchEvent: TorchEvent = {
      id: 'torch_off_ctrl_' + now + '_' + Math.random().toString(36).substring(2, 6),
      communityId,
      action: 'TORCH_OFF',
      pattern: '3_BLINKS',
      createdAt: now,
      createdBy: 'CONTROLLER'
    };
    await this.handleIncomingTorchEvent(torchEvent, true);
  }

  /**
   * Controller: Turn ON / Trigger ALL users' flashlights across all locations
   */
  public async controllerTriggerAllFlashlights() {
    const now = Date.now();
    const torchEvent: TorchEvent = {
      id: 'torch_all_' + now + '_' + Math.random().toString(36).substring(2, 6),
      communityId: 'ALL',
      action: 'BLINK_THEN_ON',
      pattern: '3_BLINKS',
      createdAt: now,
      createdBy: 'CONTROLLER'
    };
    await this.handleIncomingTorchEvent(torchEvent, true);
  }

  /**
   * Controller: Turn OFF ALL users' flashlights everywhere
   */
  public async controllerDeactivateAllFlashlights() {
    const now = Date.now();
    const torchEvent: TorchEvent = {
      id: 'torch_off_all_' + now + '_' + Math.random().toString(36).substring(2, 6),
      communityId: 'ALL',
      action: 'TORCH_OFF',
      pattern: '3_BLINKS',
      createdAt: now,
      createdBy: 'CONTROLLER'
    };
    await this.handleIncomingTorchEvent(torchEvent, true);
  }

  /**
   * Incoming report processor
   */
  private async handleIncomingReport(report: OutageReport, broadcast: boolean) {
    const exists = this.reports.some(r => r.id === report.id);
    if (!exists) {
      this.reports.push(report);
      this.notifyReports();
    }

    if (broadcast) {
      this.broadcastChannel?.postMessage({
        type: 'NEW_REPORT',
        payload: report
      });

      if (isLiveFirebaseConfigured) {
        try {
          await setDoc(doc(db, 'reports', report.id), report);
        } catch (e) {
          console.warn('Firestore report save error:', e);
        }
      }
    }
  }

  /**
   * Incoming activity processor
   */
  private async handleIncomingActivity(activity: ActivityItem, broadcast: boolean) {
    const exists = this.activities.some(a => a.id === activity.id);
    if (!exists) {
      this.activities.unshift(activity);
      if (this.activities.length > 50) this.activities.pop();
      this.notifyActivities();
    }

    if (broadcast) {
      this.broadcastChannel?.postMessage({
        type: 'NEW_ACTIVITY',
        payload: activity
      });

      if (isLiveFirebaseConfigured) {
        try {
          await setDoc(doc(db, 'activities', activity.id), activity);
        } catch (e) {
          console.warn('Firestore activity save error:', e);
        }
      }
    }
  }

  /**
   * Incoming torch event processor
   */
  public async handleIncomingTorchEvent(event: TorchEvent, broadcast: boolean) {
    if (this.processedTorchEventIds.has(event.id)) {
      return;
    }
    this.processedTorchEventIds.add(event.id);

    this.torchEvents.unshift(event);
    if (this.torchEvents.length > 20) this.torchEvents.pop();
    this.saveStorage();

    // Notify listeners
    this.torchEventListeners.forEach(fn => fn(event));

    // Determine THIS device's identity: prefer the signed-in profile of this
    // tab/session, falling back to the shared profile used for cross-tab sync.
    // Using the per-tab session (not raw localStorage) is critical: multiple tabs
    // in the same browser share localStorage, so a Controller login elsewhere must
    // NOT turn every other tab into a "controller device" that ignores signals.
    const sessionProfile = authService.getCurrentUser();
    const activeUser = localStorage.getItem('vt_active_user_profile');
    let storedProfile: ({ role?: string; communityId?: string; localityName?: string }) | null = null;
    if (activeUser) {
      try {
        storedProfile = JSON.parse(activeUser);
      } catch (e) {}
    }
    const profile = sessionProfile || storedProfile || null;

    const isControllerDevice = Boolean(
      profile?.role === 'CONTROLLER' ||
      (!sessionProfile && storedProfile?.role === 'CONTROLLER')
    );

    const targetId = (event.communityId || '').toLowerCase().trim();
    const isAll = targetId === 'all' || targetId === 'global' || targetId === '' || !event.communityId;
    const userCommId = (profile?.communityId || 'kakkanad').toLowerCase().trim();
    const locName = (profile?.localityName || '').toLowerCase().trim();

    const isTargetCommunity = isAll ||
      targetId === userCommId ||
      userCommId.includes(targetId) ||
      targetId.includes(userCommId) ||
      (locName && (locName === targetId || targetId.includes(locName) || locName.includes(targetId)));

    // Physical torch & screen strobe & audio alert trigger on citizen devices.
    // Only the device of a CONTROLLER session skips flashing — a citizen responds
    // even if they happen to be browsing a Controller page.
    if (!isControllerDevice && isTargetCommunity) {
      if (event.action === 'BLINK_THEN_ON') {
        sounds.playOutageAlert();
        torchService.blinkThenSolidOn(3, 400);
      } else if (event.action === 'TORCH_OFF') {
        torchService.turnTorchOff();
      } else if (event.action === 'SOLID_ON') {
        torchService.turnTorchOn();
      }
    }

    if (broadcast) {
      this.broadcastChannel?.postMessage({
        type: 'TORCH_EVENT',
        payload: event
      });

      if (typeof localStorage !== 'undefined') {
        try {
          localStorage.setItem('vt_live_torch_signal', JSON.stringify({
            event,
            timestamp: Date.now()
          }));
        } catch (e) {}
      }

      if (isLiveFirebaseConfigured) {
        const payload = {
          event,
          timestamp: Date.now()
        };

        if (rtdb) {
          try {
            rtdbSet(ref(rtdb, 'torchSignal'), payload).catch(e => console.warn('RTDB torch write error:', e));
          } catch (e) {}
        }

        try {
          await setDoc(doc(db, 'system', 'torchSignal'), payload);
          await setDoc(doc(db, 'torchEvents', event.id), event);
        } catch (e) {
          console.warn('Firestore torchEvent save error:', e);
        }
      }
    }
  }
}

export const outageService = new OutageService();
