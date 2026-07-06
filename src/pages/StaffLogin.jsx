import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useStaff } from '../context/StaffContext';
import { Delete, Loader2, Search, ChevronLeft, Lock } from 'lucide-react';
import CadiWordmark from '../components/CadiWordmark';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../lib/supabase';

const SUPABASE_ANON = SUPABASE_ANON_KEY;

async function fetchStaffList(token, q) {
  const url = new URL(`${SUPABASE_URL}/functions/v1/staff-auth`);
  url.searchParams.set('token', token);
  if (q) url.searchParams.set('q', q);
  const res = await fetch(url.toString(), { headers: { apikey: SUPABASE_ANON } });
  if (!res.ok) throw new Error('Invalid link');
  const data = await res.json();
  return {
    staff: data.staff ?? [],
    total: data.total ?? (data.staff ?? []).length,
    searchable: data.searchable ?? false,
  };
}

async function validatePin(token, memberId, pin) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/staff-auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON },
    body: JSON.stringify({ token, member_id: memberId, pin }),
  });
  if (res.status === 401) throw new Error('Incorrect PIN — try again');
  if (res.status === 423) {
    const { locked_until, retry_after_ms } = await res.json().catch(() => ({}));
    const ms =
      typeof retry_after_ms === 'number'
        ? retry_after_ms
        : locked_until
          ? new Date(locked_until).getTime() - Date.now()
          : 15 * 60000;
    const minutes = Math.max(1, Math.ceil(ms / 60000));
    throw new Error(
      `Too many attempts — locked for ${minutes} more minute${minutes === 1 ? '' : 's'}.`
    );
  }
  if (!res.ok) throw new Error('Something went wrong');
  const { member, staffToken } = await res.json();
  return { member, staffToken };
}

export default function StaffLogin() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { loginAsStaff } = useStaff();

  // Step 1 — identify member
  const [staff, setStaff] = useState([]);
  const [searchable, setSearchable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [invalid, setInvalid] = useState(false);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);

  // Step 2 — enter PIN
  const [selected, setSelected] = useState(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const [checking, setChecking] = useState(false);

  // Initial roster load
  useEffect(() => {
    if (!token) {
      setInvalid(true);
      setLoading(false);
      return;
    }
    fetchStaffList(token)
      .then(({ staff, searchable }) => {
        setStaff(staff);
        setSearchable(searchable);
      })
      .catch(() => setInvalid(true))
      .finally(() => setLoading(false));
  }, [token]);

  // Debounced search for large rosters
  const searchSeq = useRef(0);
  useEffect(() => {
    if (!searchable || selected) return;
    const term = query.trim();
    const seq = ++searchSeq.current;
    setSearching(true);
    const t = setTimeout(() => {
      fetchStaffList(token, term)
        .then(({ staff }) => {
          if (seq === searchSeq.current) setStaff(staff);
        })
        .catch(() => {})
        .finally(() => {
          if (seq === searchSeq.current) setSearching(false);
        });
    }, 300);
    return () => clearTimeout(t);
  }, [query, searchable, selected, token]);

  const pickMember = (member) => {
    if (!member.has_pin) return;
    setSelected(member);
    setPin('');
    setError('');
  };

  const backToPick = () => {
    setSelected(null);
    setPin('');
    setError('');
    setChecking(false);
  };

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
      const { member, staffToken } = await validatePin(token, selected.id, enteredPin);
      loginAsStaff(
        {
          id: member.id,
          name: member.name,
          role: member.role,
          hourlyRate: member.hourly_rate,
          ownerId: member.owner_id,
        },
        staffToken
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

  const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

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

  // ── Step 2 — PIN entry ───────────────────────────────────────────────────
  if (selected) {
    return (
      <div className="min-h-screen bg-[#010a4f] flex flex-col items-center justify-center px-4">
        <button
          onClick={backToPick}
          className="absolute top-6 left-6 flex items-center gap-1 text-[#99c5ff] text-sm font-semibold hover:text-white transition-colors"
        >
          <ChevronLeft size={18} /> Back
        </button>

        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <CadiWordmark height={32} />
          </div>
          <h1 className="text-2xl font-black text-white">{selected.name}</h1>
          {selected.role && (
            <p className="text-[#99c5ff] text-sm mt-1 capitalize">{selected.role}</p>
          )}
          <p className="text-[#99c5ff]/50 text-xs mt-1">Enter your 4-digit PIN</p>
        </div>

        {/* PIN dots */}
        <div className={`flex items-center gap-4 mb-6 ${shake ? 'animate-bounce' : ''}`}>
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`w-5 h-5 rounded-full border-2 transition-all ${
                pin.length > i ? 'bg-[#1f48ff] border-[#1f48ff] scale-110' : 'border-white/40'
              }`}
            />
          ))}
        </div>

        {/* Error */}
        {error && (
          <p className="text-red-400 text-sm font-semibold mb-4 text-center max-w-xs">{error}</p>
        )}

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-3 w-64">
          {KEYS.map((key, i) => (
            <button
              key={i}
              onClick={() => {
                if (key === 'del') setPin((p) => p.slice(0, -1));
                else if (key !== '') addDigit(key);
              }}
              disabled={checking}
              className={`h-16 rounded-2xl text-xl font-black transition-all active:scale-95 disabled:opacity-50 ${
                key === ''
                  ? 'invisible'
                  : key === 'del'
                    ? 'bg-white/10 text-white/60 hover:bg-white/20'
                    : 'bg-white/10 text-white hover:bg-[#1f48ff] active:bg-[#1f48ff]'
              }`}
            >
              {key === 'del' ? <Delete size={20} className="mx-auto" /> : key}
            </button>
          ))}
        </div>

        <p className="text-[10px] text-[#99c5ff]/40 mt-8 text-center">
          By signing in you agree to our{' '}
          <Link
            to="/terms"
            target="_blank"
            className="text-[#99c5ff]/70 hover:text-white underline"
          >
            Terms
          </Link>{' '}
          and{' '}
          <Link
            to="/privacy"
            target="_blank"
            className="text-[#99c5ff]/70 hover:text-white underline"
          >
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    );
  }

  // ── Step 1 — pick / search member ────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#010a4f] flex flex-col items-center justify-center px-4 py-12">
      <div className="text-center mb-8">
        <div className="flex justify-center mb-4">
          <CadiWordmark height={32} />
        </div>
        <h1 className="text-2xl font-black text-white">Team Login</h1>
        <p className="text-[#99c5ff]/50 text-xs mt-1">
          {searchable ? 'Search for your name to sign in' : 'Tap your name to sign in'}
        </p>
      </div>

      {searchable && (
        <div className="relative w-full max-w-sm mb-5">
          <Search
            size={18}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-[#99c5ff]/60"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your name…"
            autoFocus
            className="w-full h-12 pl-11 pr-4 rounded-2xl bg-white/10 text-white placeholder-[#99c5ff]/40 font-semibold outline-none border-2 border-transparent focus:border-[#1f48ff] transition-colors"
          />
          {searching && (
            <Loader2
              size={18}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-[#99c5ff] animate-spin"
            />
          )}
        </div>
      )}

      <div className="w-full max-w-sm grid grid-cols-1 gap-2.5">
        {staff.length === 0 ? (
          <p className="text-[#99c5ff]/60 text-sm text-center py-6">
            {searchable && query.trim()
              ? 'No matches — check the spelling.'
              : 'No team members found.'}
          </p>
        ) : (
          staff.map((member) => (
            <button
              key={member.id}
              onClick={() => pickMember(member)}
              disabled={!member.has_pin}
              className={`w-full flex items-center justify-between gap-3 px-5 h-14 rounded-2xl text-left font-black transition-all active:scale-[0.98] ${
                member.has_pin
                  ? 'bg-white/10 text-white hover:bg-[#1f48ff]'
                  : 'bg-white/5 text-white/40 cursor-not-allowed'
              }`}
            >
              <span className="truncate">
                {member.name}
                {member.role && (
                  <span className="block text-xs font-semibold text-[#99c5ff]/70 capitalize">
                    {member.role}
                  </span>
                )}
              </span>
              {!member.has_pin && (
                <span className="flex items-center gap-1 text-[10px] font-bold text-white/40 shrink-0">
                  <Lock size={12} /> No PIN
                </span>
              )}
            </button>
          ))
        )}
      </div>

      <p className="text-[10px] text-[#99c5ff]/40 mt-8 text-center">
        By signing in you agree to our{' '}
        <Link to="/terms" target="_blank" className="text-[#99c5ff]/70 hover:text-white underline">
          Terms
        </Link>{' '}
        and{' '}
        <Link
          to="/privacy"
          target="_blank"
          className="text-[#99c5ff]/70 hover:text-white underline"
        >
          Privacy Policy
        </Link>
        .
      </p>
    </div>
  );
}
