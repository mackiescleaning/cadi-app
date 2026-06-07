import { useState, useEffect } from 'react';
import { getConsent, setConsent, initFullStory } from '../lib/fullstory';

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!getConsent()) setVisible(true);
  }, []);

  function accept() {
    setConsent('accepted');
    initFullStory();
    setVisible(false);
  }

  function decline() {
    setConsent('declined');
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 sm:p-6">
      <div className="max-w-2xl mx-auto bg-[#0d1b6e] border border-white/10 rounded-2xl px-5 py-4 shadow-2xl flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <p className="text-sm text-[rgba(153,197,255,0.85)] flex-1 leading-relaxed">
          We use session recording (FullStory) to improve Cadi. Financial and bank data is never recorded.{' '}
          <a href="/privacy" className="underline text-[#99c5ff]">Privacy policy</a>
        </p>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={decline}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-[rgba(153,197,255,0.7)] hover:text-white transition-colors"
          >
            Decline
          </button>
          <button
            onClick={accept}
            className="px-4 py-2 rounded-xl text-sm font-bold bg-[#1f48ff] text-white hover:bg-[#1a3de0] transition-colors"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
