import { useState, useEffect } from 'react';
import { Community } from '../types';
import { communityService } from '../services/communityService';
import { authService } from '../services/authService';

export function useCommunity(selectedCommunityId?: string) {
  const [communities, setCommunities] = useState<Community[]>(communityService.getAllCommunities());

  useEffect(() => {
    const unsub = communityService.subscribe((list) => {
      setCommunities(list);
    });
    return unsub;
  }, []);

  const activeCommunityId = selectedCommunityId || authService.getCurrentUser()?.communityId || 'kakkanad';
  const currentCommunity = communities.find(c => c.id === activeCommunityId) || communities[0];

  const changeUserCommunity = async (commId: string) => {
    const target = communities.find(c => c.id === commId);
    if (target) {
      await authService.updateCommunity(commId, target.pincode, target.name, target.district);
    }
  };

  const addDynamicCommunity = async (comm: Community) => {
    const created = await communityService.addOrGetDynamicCommunity(comm);
    await authService.updateCommunity(created.id, created.pincode, created.name, created.district);
    return created;
  };

  const createCustomCommunity = async (name: string, district: string, pincode: string, lat?: number, lng?: number) => {
    const created = await communityService.registerCustomUserCommunity(name, district, pincode, lat, lng);
    await authService.updateCommunity(created.id, created.pincode, created.name, created.district);
    return created;
  };

  return {
    communities,
    currentCommunity,
    changeUserCommunity,
    addDynamicCommunity,
    createCustomCommunity,
    resetAllToNormal: () => communityService.resetAllToNormal()
  };
}

