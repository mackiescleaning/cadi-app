import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import PricingCalculator from '../components/PricingCalculator';
import { addAcceptedQuoteIncome, getStoredPricingIncome } from '../lib/pricingStore';

const BASE_ACCOUNTS_DATA = {
  vatRegistered: false,
  frsRate: 12,
  isLimitedCostTrader: false,
  taxRate: 0.2,
  annualProfit: 33480,
  annualTarget: 65000,
  ytdIncome: 41820,
};

export default function Calculator() {
  const { user, profile } = useAuth();
  const [acceptedQuoteIncome, setAcceptedQuoteIncome] = useState([]);
  const [userHourlyRate, setUserHourlyRate]           = useState(null);

  // Load accepted quotes
  useEffect(() => {
    let mounted = true;
    (async () => {
      const entries = await getStoredPricingIncome();
      if (mounted) setAcceptedQuoteIncome(entries);
    })();
    return () => { mounted = false; };
  }, []);

  // Load hourly rate from business_settings.setup_data
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('business_settings')
        .select('setup_data')
        .eq('owner_id', user.id)
        .single();
      const rate = data?.setup_data?.hourly_rate;
      if (rate && !isNaN(parseFloat(rate))) {
        setUserHourlyRate(parseFloat(rate));
      }
    })();
  }, [user]);

  const addedIncome = acceptedQuoteIncome.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const accountsData = {
    ...BASE_ACCOUNTS_DATA,
    ytdIncome:    BASE_ACCOUNTS_DATA.ytdIncome + addedIncome,
    annualProfit: BASE_ACCOUNTS_DATA.annualProfit + addedIncome * 0.7,
    staffHourlyRate: userHourlyRate,
  };

  async function handleAcceptedQuote(quote) {
    const entries = await addAcceptedQuoteIncome(quote);
    setAcceptedQuoteIncome(entries);
  }

  // Derive sector hint from profile to open the right tab by default
  const sectorHint = profile?.cleaner_type ?? null;

  return (
    <PricingCalculator
      accountsData={accountsData}
      userHourlyRate={userHourlyRate}
      sectorHint={sectorHint}
      onAcceptedQuote={handleAcceptedQuote}
    />
  );
}
