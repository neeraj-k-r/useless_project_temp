import { useState, useEffect } from 'react';
import { UserProfile, UserRole } from '../types';
import { authService } from '../services/authService';

export function useAuth() {
  const [user, setUser] = useState<UserProfile | null>(authService.getCurrentUser());
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    const unsub = authService.subscribe((u) => {
      setUser(u);
    });
    return unsub;
  }, []);

  const loginWithEmail = async (
    email: string, 
    pass: string, 
    communityId?: string, 
    pincode?: string,
    localityName?: string,
    district?: string
  ) => {
    setLoading(true);
    try {
      return await authService.loginWithEmail(email, pass, communityId, pincode, localityName, district);
    } finally {
      setLoading(false);
    }
  };

  const registerWithEmail = async (
    name: string,
    email: string,
    pass: string,
    communityId: string,
    pincode: string,
    phone?: string,
    address?: string,
    localityName?: string,
    district?: string
  ) => {
    setLoading(true);
    try {
      return await authService.registerWithEmail(name, email, pass, communityId, pincode, phone, address, localityName, district);
    } finally {
      setLoading(false);
    }
  };

  const signInWithGooglePopup = async () => {
    setLoading(true);
    try {
      return await authService.signInWithGooglePopup();
    } finally {
      setLoading(false);
    }
  };

  const completeGoogleProfile = async (details: {
    uid: string;
    name: string;
    email: string;
    phone?: string;
    address?: string;
    communityId: string;
    localityName?: string;
    district?: string;
    pincode: string;
  }) => {
    setLoading(true);
    try {
      return await authService.completeGoogleProfile(details);
    } finally {
      setLoading(false);
    }
  };

  const loginWithGoogle = async (details?: {
    uid?: string;
    name?: string;
    email?: string;
    phone?: string;
    address?: string;
    communityId?: string;
    localityName?: string;
    district?: string;
    pincode?: string;
  }) => {
    setLoading(true);
    try {
      return await authService.loginWithGoogle(details);
    } finally {
      setLoading(false);
    }
  };

  const loginAsController = async (email: string, pass: string) => {
    setLoading(true);
    try {
      return await authService.verifyAndLoginController(email, pass);
    } finally {
      setLoading(false);
    }
  };

  const switchToUserRole = async () => {
    if (!user) return;
    await authService.setRole('USER');
  };

  const logout = async () => {
    await authService.signOut();
  };

  const toggleRole = () => {
    if (!user) return;
    const nextRole: UserRole = user.role === 'CONTROLLER' ? 'USER' : 'CONTROLLER';
    authService.setRole(nextRole);
  };

  return {
    user,
    loading,
    loginWithEmail,
    registerWithEmail,
    loginWithGoogle,
    signInWithGooglePopup,
    completeGoogleProfile,
    loginAsController,
    switchToUserRole,
    logout,
    toggleRole,
    isController: user?.role === 'CONTROLLER'
  };
}
