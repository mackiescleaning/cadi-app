import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import CadiWordmark from '../CadiWordmark';

export default function ProtectedRoute({ children }) {
  const { user, profile, loading, profileLoading } = useAuth();

  const isLoading = loading || (user && profileLoading);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#010a4f] flex items-center justify-center">
        <div className="text-center">
          <div className="flex justify-center mb-4 animate-pulse"><CadiWordmark height={28} /></div>
          <p className="text-[#99c5ff] text-sm font-semibold">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
