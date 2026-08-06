import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';

interface UseAdminAuthReturn {
  isAdmin: boolean;
  isLoading: boolean;
  userRole: 'admin' | 'moderator' | 'user' | null;
}

export function useAdminAuth(): UseAdminAuthReturn {
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [userRole, setUserRole] = useState<'admin' | 'moderator' | 'user' | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function checkAdminRole() {
      if (!user) {
        setIsAdmin(false);
        setUserRole(null);
        setIsLoading(false);
        return;
      }

      try {
        // Use the database function to get user role
        const { data, error } = await supabase
          .rpc('get_user_role', { _user_id: user.id });

        if (error) {
          console.error('Error checking admin role:', error);
          setIsAdmin(false);
          setUserRole(null);
        } else {
          const role = data as 'admin' | 'moderator' | 'user' | null;
          setUserRole(role);
          setIsAdmin(role === 'admin');
        }
      } catch (err) {
        console.error('Error in admin check:', err);
        setIsAdmin(false);
        setUserRole(null);
      }

      setIsLoading(false);
    }

    if (!authLoading) {
      checkAdminRole();
    }
  }, [user, authLoading]);

  return { isAdmin, isLoading: isLoading || authLoading, userRole };
}
