import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useStaff } from '../context/StaffContext';
import { Delete, Loader2 } from 'lucide-react';
import CadiWordmark from '../components/CadiWordmark';

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY;

async function fetchStaffList(token) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/staff-auth?token=${token}`, {
    headers: { apikey: SUPABASE_ANON },
  });
  if (!res.ok) throw new Error('Invalid link');
  const { staff } = await res.json();
  return staff ?? [];
}

async function validatePin(token, pin) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/staff-auth`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON },
    body:    JSON.stringify({ token, pin }),
  });
  if (res.status === 401) throw new Error('Incorrect PIN — try again');
  if (res.status === 423) {
    const { locked_until } = await res.json().catch(() => ({}));
    const minutes = locked_until
      ? Math.max(1, Math.ceil((new Date(locked_until).getTime() - Date.now()) / 60000))
      : 15;
    throw new Error(`Too many attempts — locked for ${minutes} more minute${minutes === 1 ? '' : 's'}.`);
  }
  if (!res.ok) throw new Error('Something went wrong');
  const { member, staffToken } = await res.json();
  return { member, staffToken };
}

export default function StaffLogin() {
  const { token }  = useParams();
  const navigate   = useNavigate();
  const { loginAsStaff } = useStaff();

  const [pin, setPin]         = useState('');
  const [error, setError]     = useState('');
  const [shake, setShake]     = useState(false);
  const [staff, setStaff]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [invalid, setInvalid] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!token) { setInvalid(true); setLoading(false); return; }
    fetchStaffList(token)
      .then(s => setStaff(s))
      .catch(() => setInvalid(true))
      .finally(() => setLoading(false));
  }, [token]);

  const addDigit = (d) => {
    if (pin.length >= 4 || checking) return;
    const next = pin + d;
    setPin(next);
    setError('');
    if (next.length === 4) setTimeout(() => checkPin(next), 200);
  };

  const checkPin = async (enteredPin) => {
    setChecking(true);
    try {
      const { member, staffToken } = await validatePin(token, enteredPin);
      loginAsStaff(
        { id: member.id, name: member.name, role: member.role, hourlyRate: member.hourly_rate, ownerId: member.owner_id },
        staffToken,
      );
      navigate('/staff-dashboard');
    } catch (err) {
      setShake(true);
      setError(err.message);
      setPin('');
      setTimeout(() => setShake(false), 500);
    } finally {
      setChecking(false);
    }
  };

  const KEYS = ['1','2','3','4','5','6','7','8','9','','0','del'];

  if (loading) {
    return (
      <div className="min-h-screen bg-[#010a4f] flex items-center justify-center">
        <Loader2 size={32} className="text-[#99c5ff] animate-spin" />
      </div>
    );
  }

  if (invalid) {
    return (
      <div className="min-h-screen bg-[#010a4f] flex flex-col items-center justify-center px-4 text-center">
        <CadiWordmark height={28} />
        <p className="text-white text-lg font-black mt-6 mb-2">Invalid staff login link</p>
        <p className="text-[#99c5ff] text-sm">Ask your manager for the correct link.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#010a4f] flex flex-col items-center justify-center px-4">

      {/* Logo */}
      <div className="text-center mb-8">
        <div className="flex justify-center mb-4"><CadiWordmark height={32} /></div>
        <h1 className="text-2xl font-black text-white">Team Login</h1>
        {staff.length > 0 && (
          <p className="text-[#99c5ff] text-sm mt-1">
            {staff.map(s => s.name).join(' · ')}
          </p>
        )}
        <p className="text-[#99c5ff]/50 text-xs mt-1">Enter your 4-digit PIN</p>
      </div>

      {/* PIN dots */}
      <div className={`flex items-center gap-4 mb-6 ${shake ? 'animate-bounce' : ''}`}>
        {[0,1,2,3].map(i => (
          <div key={i} className={`w-5 h-5 rounded-full border-2 transition-all ${
            pin.length > i ? 'bg-[#1f48ff] border-[#1f48ff] scale-110' : 'border-white/40'
          }`} />
        ))}
      </div>

      {/* Error */}
      {error && <p className="text-red-400 text-sm font-semibold mb-4">{error}</p>}

      {/* Keypad */}
      <div className="grid grid-cols-3 gap-3 w-64">
        {KEYS.map((key, i) => (
          <button
            key={i}
            onClick={() => {
              if (key === 'del') setPin(p => p.slice(0, -1));
              else if (key !== '') addDigit(key);
            }}
            disabled={checking}
            className={`h-16 rounded-2xl text-xl font-black transition-all active:scale-95 disabled:opacity-50 ${
              key === '' ? 'invisible'
              : key === 'del' ? 'bg-white/10 text-white/60 hover:bg-white/20'
              : 'bg-white/10 text-white hover:bg-[#1f48ff] active:bg-[#1f48ff]'
            }`}
          >
            {key === 'del' ? <Delete size={20} className="mx-auto" /> : key}
          </button>
        ))}
      </div>

      <p className="text-[10px] text-[#99c5ff]/40 mt-8">
        By signing in you agree to our{' '}
        <Link to="/terms" target="_blank" className="text-[#99c5ff]/70 hover:text-white underline">Terms</Link>
        {' '}and{' '}
        <Link to="/privacy" target="_blank" className="text-[#99c5ff]/70 hover:text-white underline">Privacy Policy</Link>.
      </p>

    </div>
  );
}
