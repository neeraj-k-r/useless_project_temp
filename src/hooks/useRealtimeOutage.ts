import { useState, useEffect, useMemo } from 'react';
import { OutageReport, ActivityItem, TorchEvent } from '../types';
import { outageService } from '../services/outageService';
import { useAuth } from './useAuth';
import { useCommunity } from './useCommunity';

export function useRealtimeOutage(targetCommunityId?: string) {
  const { user } = useAuth();
  const { currentCommunity } = useCommunity(targetCommunityId);
  
  const [reports, setReports] = useState<OutageReport[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastNotice, setLastNotice] = useState<string | null>(null);

  const activeCommunityId = targetCommunityId || currentCommunity.id;

  useEffect(() => {
    const unsubReports = outageService.subscribeReports((reps) => {
      setReports([...reps]);
    });

    const unsubActs = outageService.subscribeActivities((acts) => {
      setActivities([...acts]);
    });

    return () => {
      unsubReports();
      unsubActs();
    };
  }, []);

  const activeOutageReports = useMemo(() => {
    return outageService.getActiveReportsForCommunity(activeCommunityId, 'CURRENT_POYI');
  }, [reports, activeCommunityId]);

  const activeRestoreReports = useMemo(() => {
    return outageService.getActiveReportsForCommunity(activeCommunityId, 'CURRENT_VANNU');
  }, [reports, activeCommunityId]);

  const hasReportedOutage = useMemo(() => {
    if (!user) return false;
    return outageService.hasUserReportedRecently(user.uid, activeCommunityId, 'CURRENT_POYI');
  }, [reports, user, activeCommunityId]);

  const hasReportedRestore = useMemo(() => {
    if (!user) return false;
    return outageService.hasUserReportedRecently(user.uid, activeCommunityId, 'CURRENT_VANNU');
  }, [reports, user, activeCommunityId]);

  const userReportStatus = useMemo(() => {
    if (!user) return null;
    return outageService.getUserActiveStatus(user.uid, activeCommunityId);
  }, [reports, user, activeCommunityId]);

  const reportCurrentPoyi = async () => {
    if (!user) return;
    setIsSubmitting(true);
    setLastNotice(null);
    try {
      const res = await outageService.reportCurrentPoyi(user.uid, user.name, activeCommunityId);
      setLastNotice(res.message);
      return res;
    } finally {
      setIsSubmitting(false);
    }
  };

  const reportCurrentVannu = async () => {
    if (!user) return;
    setIsSubmitting(true);
    setLastNotice(null);
    try {
      const res = await outageService.reportCurrentVannu(user.uid, user.name, activeCommunityId);
      setLastNotice(res.message);
      return res;
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    reports,
    activities,
    activeOutageReports,
    activeRestoreReports,
    hasReportedOutage,
    hasReportedRestore,
    userReportStatus,
    isSubmitting,
    lastNotice,
    reportCurrentPoyi,
    reportCurrentVannu,
    controllerTriggerTorch: () => outageService.controllerTriggerTorch(activeCommunityId),
    controllerTriggerAllFlashlights: () => outageService.controllerTriggerAllFlashlights(),
    controllerDeactivateAllFlashlights: () => outageService.controllerDeactivateAllFlashlights(),
    controllerRestorePower: () => outageService.restorePower(activeCommunityId, 'CONTROLLER')
  };
}
