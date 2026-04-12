import { createContext, useContext, useState } from 'react';

const StaffContext = createContext({});

export function StaffProvider({ children }) {
  const [staffMember, setStaffMember] = useState(() => {
    const saved = sessionStorage.getItem('staff_session');
    return saved ? JSON.parse(saved) : null;
  });

  function loginAsStaff(member) {
    sessionStorage.setItem('staff_session', JSON.stringify(member));
    setStaffMember(member);
  }

  function logoutStaff() {
    sessionStorage.removeItem('staff_session');
    setStaffMember(null);
  }

  return (
    <StaffContext.Provider value={{ staffMember, loginAsStaff, logoutStaff }}>
      {children}
    </StaffContext.Provider>
  );
}

export const useStaff = () => useContext(StaffContext);
