import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import PricingCalculator from '../components/PricingCalculator';
import { saveDraftQuote, acceptSavedQuote, getStoredPricingIncome } from '../lib/pricingStore';
import { getBusinessSettings } from '../lib/db/settingsDb';
import { listMoneyEntries } from '../lib/db/moneyDb';

function startOfTaxYear() {
  const now = new Date();
  const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return `${year}-04-06`;
}

export default function Calculator() {
  const { user, profile } = useAuth();
  const [acceptedQuoteIncome, setAcceptedQuoteIncome] = useState([]);
  const [userHourlyRate, setUserHourlyRate]           = useState(null);
  const [settings, setSettings]                       = useState(null);
  const [ytdIncome, setYtdIncome]                     = useState(0);
  const [loading, setLoading]                         = useState(true);

  // Load accepted quotes
  useEffect(() => {
    let mounted = true;
    (async () => {
      const entries = await getStoredPricingIncome();
      if (mounted) setAcceptedQuoteIncome(entries);
    })();
    return () => { mounted = false; };
  }, []);

  // Load business settings + compute real YTD income
  useEffect(() => {
    if (!user) { setLoading(false); return; }
    let mounted = true;

    (async () => {
      try {
        const [settingsData, moneyEntries] = await Promise.all([
          getBusinessSettings(),
          listMoneyEntries(2000),
        ]);

        if (!mounted) return;

        if (settingsData) {
          setSettings(settingsData);
          const rate = settingsData.setup_data?.hourly_rate;
          if (rate && !isNaN(parseFloat(rate))) {
            setUserHourlyRate(parseFloat(rate));
          }
        }

        // Compute YTD income from money_entries
        const taxYearStart = startOfTaxYear();
        const income = (moneyEntries || [])
          .filter(e => e.kind === 'income' && e.date >= taxYearStart)
          .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
        setYtdIncome(income);
      } catch (err) {
        console.error('Failed to load calculator data:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => { mounted = false; };
  }, [user]);

  const addedIncome = acceptedQuoteIncome.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const totalYtdIncome = ytdIncome + addedIncome;
  const taxRate = settings?.tax_rate ?? 0.20;
  const annualTarget = Number(settings?.annual_target) || 0;

  const accountsData = {
    vatRegistered:      Boolean(settings?.vat_registered),
    frsRate:            Number(settings?.frs_rate) || 12,
    isLimitedCostTrader: Boolean(settings?.setup_data?.is_limited_cost_trader),
    taxRate,
    annualTarget,
    ytdIncome:          totalYtdIncome,
    annualProfit:       totalYtdIncome * (1 - taxRate),
    staffHourlyRate:    userHourlyRate,
  };

  async function handleSaveDraft(quote) {
    return await saveDraftQuote(quote);
  }

  async function handleAcceptQuote(savedQuote) {
    const entries = await acceptSavedQuote(savedQuote);
    setAcceptedQuoteIncome(entries);
  }

  // Derive sector hint from profile to open the right tab by default
  const sectorHint = profile?.cleaner_type ?? null;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#010a4f] flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="w-4 h-4 border-2 border-[#99c5ff] border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-semibold text-[#99c5ff]">Loading pricing data...</span>
        </div>
      </div>
    );
  }

  return (
    <PricingCalculator
      accountsData={accountsData}
      userHourlyRate={userHourlyRate}
      sectorHint={sectorHint}
      onSaveDraft={handleSaveDraft}
      onAcceptQuote={handleAcceptQuote}
    />
  );
}
