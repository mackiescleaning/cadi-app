import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function ProtectedRoute({ children }) {
  const { user, profile, loading, profileLoading } = useAuth();

  const isLoading = loading || (user && profileLoading);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#010a4f] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#1f48ff] flex items-center justify-center mx-auto mb-4 animate-pulse">
            <span className="text-white font-black text-2xl">CB</span>
          </div>
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
