import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { listMyClients, logAuditAction } from '../lib/db/teamDb';

const ClientContext = createContext(null);

/**
 * Tracks whether the logged-in user is viewing as an accountant.
 * If activeClient is set, all data queries should scope to activeClient.owner_id.
 *
 * For components: use useClientContext() to get activeClient and switchClient.
 * activeClient shape: { id, owner_id, role, access_level, status }
 */
export function ClientProvider({ children }) {
  const [clients, setClients] = useState([]); // all clients this accountant can see
  const [activeClient, setActiveClient] = useState(null); // currently viewed client
  const [isAccountant, setIsAccountant] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          setLoading(false);
          return;
        }

        const myClients = await listMyClients();
        if (!mounted) return;

        if (myClients.length > 0) {
          setClients(myClients);
          setIsAccountant(true);
          // Restore last active client from sessionStorage
          const saved = sessionStorage.getItem('cadi_active_client');
          if (saved) {
            const parsed = myClients.find((c) => c.owner_id === saved);
            if (parsed) setActiveClient(parsed);
          }
        }
      } catch {
        // Not an accountant or error — stay as normal user
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const switchClient = useCallback(async (client) => {
    setActiveClient(client);
    if (client) {
      sessionStorage.setItem('cadi_active_client', client.owner_id);
      await logAuditAction({
        memberId: client.id,
        ownerId: client.owner_id,
        action: 'switched_to_client',
      }).catch(() => {});
    } else {
      sessionStorage.removeItem('cadi_active_client');
    }
  }, []);

  const exitClientView = useCallback(() => {
    setActiveClient(null);
    sessionStorage.removeItem('cadi_active_client');
  }, []);

  return (
    <ClientContext.Provider
      value={{
        clients,
        activeClient,
        isAccountant,
        loading,
        switchClient,
        exitClientView,
        // The owner_id to use for all data queries
        // null means use the logged-in user's own data
        viewingOwnerId: activeClient?.owner_id ?? null,
        viewingAccessLevel: activeClient?.access_level ?? null,
        isReadOnly: activeClient?.access_level === 'read_only',
      }}
    >
      {children}
    </ClientContext.Provider>
  );
}

export function useClientContext() {
  const ctx = useContext(ClientContext);
  if (!ctx) throw new Error('useClientContext must be used within ClientProvider');
  return ctx;
}
