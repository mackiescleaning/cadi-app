import { createContext, useContext, useState } from 'react';

const StaffContext = createContext({});

const SESSION_KEY = 'staff_session';
const TOKEN_KEY   = 'staff_token';

export function StaffProvider({ children }) {
  const [staffMember, setStaffMember] = useState(() => {
    const saved = sessionStorage.getItem(SESSION_KEY);
    return saved ? JSON.parse(saved) : null;
  });
  const [staffToken, setStaffToken] = useState(() => sessionStorage.getItem(TOKEN_KEY));

  function loginAsStaff(member, token) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(member));
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    setStaffMember(member);
    if (token) setStaffToken(token);
  }

  function logoutStaff() {
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    setStaffMember(null);
    setStaffToken(null);
  }

  // Convenience: build the Authorization-bearing fetch options for a staff
  // edge function call. Returns null if there's no token (caller should
  // bounce to /staff-login).
  function staffFetchInit(extra = {}) {
    if (!staffToken) return null;
    return {
      ...extra,
      headers: {
        ...(extra.headers || {}),
        Authorization: `Bearer ${staffToken}`,
        apikey:        import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
    };
  }

  return (
    <StaffContext.Provider value={{ staffMember, staffToken, loginAsStaff, logoutStaff, staffFetchInit }}>
      {children}
    </StaffContext.Provider>
  );
}

export const useStaff = () => useContext(StaffContext);
