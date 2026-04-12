import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStaff } from '../context/StaffContext';
import { Delete, ArrowLeft, BookOpen } from 'lucide-react';

const STAFF_MEMBERS = [
  { id: 1, name: 'Emma Clarke', role: 'Lead Cleaner', pin: '1234', color: 'bg-[#1f48ff]', hourlyRate: 13.50 },
  { id: 2, name: 'Tom Hughes', role: 'Cleaner', pin: '5678', color: 'bg-[#010a4f]', hourlyRate: 12.00 },
];

export default function StaffLogin() {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const { loginAsStaff } = useStaff();
  const navigate = useNavigate();

  const addDigit = (d) => {
    if (pin.length >= 4) return;
    const newPin = pin + d;
    setPin(newPin);
    setError('');
    if (newPin.length === 4) {
      setTimeout(() => checkPin(newPin), 200);
    }
  };

  const checkPin = (enteredPin) => {
    const match = STAFF_MEMBERS.find(m => m.pin === enteredPin);
    if (match) {
      loginAsStaff(match);
      navigate('/staff-dashboard');
    } else {
      setShake(true);
      setError('Incorrect PIN — try again');
      setPin('');
      setTimeout(() => setShake(false), 500);
    }
  };

  const deleteDigit = () => setPin(p => p.slice(0, -1));

  const KEYS = ['1','2','3','4','5','6','7','8','9','','0','del'];

  return (
    <div className="min-h-screen bg-[#010a4f] flex flex-col items-center justify-center px-4">

      {/* Logo */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 rounded-2xl bg-[#1f48ff] flex items-center justify-center mx-auto mb-4 shadow-2xl">
          <BookOpen size={28} className="text-white" />
        </div>
        <h1 className="text-2xl font-black text-white">Team Login</h1>
        <p className="text-[#99c5ff] text-sm mt-1">Enter your 4-digit PIN</p>
      </div>

      {/* PIN dots */}
      <div className={`flex items-center gap-4 mb-6 ${shake ? 'animate-bounce' : ''}`}>
        {[0,1,2,3].map(i => (
          <div key={i} className={`w-5 h-5 rounded-full border-2 transition-all ${
            pin.length > i
              ? 'bg-[#1f48ff] border-[#1f48ff] scale-110'
              : 'border-white/40'
          }`} />
        ))}
      </div>

      {/* Error */}
      {error && (
        <p className="text-red-400 text-sm font-semibold mb-4">{error}</p>
      )}

      {/* Keypad */}
      <div className="grid grid-cols-3 gap-3 w-64">
        {KEYS.map((key, i) => (
          <button
            key={i}
            onClick={() => {
              if (key === 'del') deleteDigit();
              else if (key !== '') addDigit(key);
            }}
            className={`h-16 rounded-2xl text-xl font-black transition-all active:scale-95 ${
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

      {/* Back to manager login */}
      <button
        onClick={() => navigate('/login')}
        className="mt-8 flex items-center gap-2 text-[#99c5ff] text-sm hover:text-white transition-colors"
      >
        <ArrowLeft size={15} /> Back to manager login
      </button>
    </div>
  );
}
