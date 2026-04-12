// src/components/BusinessLabTab.jsx
// Cadi — Business Lab (renamed from Scaling Tools)
//
// Six tools that answer the questions every growing cleaner actually has.
// Verdict-first design: the answer appears before the numbers, not after.
//
//   01  Hire a cleaner         — will this hire make me money or cost me money?
//   02  Sole trader vs Ltd     — should I go limited? what's the real difference?
//   03  Raise my prices        — how much, when, and message templates to send
//   04  Add a new service      — is it worth it? play with mock business presets
//   05  Most valuable hour     — which work earns you the most per hour?
//   06  Org chart builder      — design your business structure with live cost model
//
// Props:
//   accountsData — live from useAccountsData hook
//   onNavigate   — switch to another tab

import { useState, useMemo, useCallback } from "react";

// ─── Defaults ─────────────────────────────────────────────────────────────────
const DEFAULT_ACCOUNTS = {
  vatRegistered: false, taxRate: 0.20,
  ytdIncome: 41820, annualTarget: 65000, annualProfit: 33480,
  ytdExpenses: 8340,
};

// ─── Tax helpers (2025/26 rates) ──────────────────────────────────────────────
function calcSoleTax(profit) {
  const pa = 12570;
  const taxable  = Math.max(0, profit - pa);
  const basic    = Math.min(taxable, 37700) * 0.20;
  const higher   = Math.max(0, taxable - 37700) * 0.40;
  const ni       = Math.max(0, profit - pa) * 0.09;
  const total    = basic + higher + ni;
  return { basic, higher, ni, total, takeHome: profit - total };
}

function calcLtdTax(profit, salary) {
  const rate     = profit > 250000 ? 0.25 : profit > 50000 ? 0.19 + ((profit-50000)/200000)*0.06 : 0.19;
  const corpP    = Math.max(0, profit - salary);
  const corpTax  = corpP * rate;
  const afterC   = corpP - corpTax;
  const salTax   = Math.min(Math.max(0,salary-12570), 37700) * 0.20 + Math.max(0,salary-12570-37700)*0.40;
  const divTax   = Math.min(Math.max(0,afterC-500), Math.max(0,37700-Math.max(0,salary-12570))) * 0.0875
                 + Math.max(0, afterC-500-Math.max(0,37700-Math.max(0,salary-12570))) * 0.3375;
  return { corpTax, salTax, divTax, totalTax: corpTax+salTax+divTax, takeHome: salary+afterC-salTax-divTax };
}

function calcEmployerNI(annualWage) {
  return Math.max(0, (annualWage - 9100) * 0.138);
}

// ─── Format ───────────────────────────────────────────────────────────────────
const fmt  = n => `£${Math.round(Math.abs(+n)).toLocaleString()}`;
const fmt2 = n => `£${Math.abs(+n).toFixed(2)}`;
const pct  = n => `${Math.round(+n)}%`;

// ─── Shared UI ────────────────────────────────────────────────────────────────
const Card = ({ children, className = "" }) =>
  <div className={`bg-white border border-gray-200 rounded-sm ${className}`}>{children}</div>;

const SL = ({ children, className = "" }) =>
  <p className={`text-xs font-bold tracking-widests uppercase text-gray-400 ${className}`}>{children}</p>;

function Chip({ children, color = "blue" }) {
  const s = {
    blue:"bg-blue-50 text-brand-blue border-blue-200", green:"bg-emerald-50 text-emerald-700 border-emerald-200",
    warn:"bg-amber-50 text-amber-700 border-amber-200", red:"bg-red-50 text-red-700 border-red-200",
    navy:"bg-brand-navy text-white border-brand-navy", sky:"bg-brand-skyblue/20 text-brand-navy border-brand-skyblue",
    gray:"bg-gray-100 text-gray-500 border-gray-200", orange:"bg-orange-50 text-orange-700 border-orange-200",
  };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-bold border ${s[color]}`}>{children}</span>;
}

function Alert({ type = "blue", children }) {
  const s = { warn:"bg-amber-50 border-amber-200 text-amber-800", green:"bg-emerald-50 border-emerald-200 text-emerald-800", blue:"bg-blue-50 border-blue-200 text-blue-800", gold:"bg-yellow-50 border-yellow-200 text-yellow-800" };
  const icons = { warn:"!", green:"✓", blue:"i", gold:"→" };
  return (
    <div className={`flex gap-3 p-3 border text-sm leading-relaxed rounded-sm ${s[type]}`}>
      <span className="shrink-0 mt-0.5 text-xs font-bold w-4 text-center">{icons[type]}</span>
      <div>{children}</div>
    </div>
  );
}

function Slider({ label, value, min, max, step, onChange, display, hint }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold tracking-widest uppercase text-gray-400">{label}</label>
        <span className="text-sm font-bold tabular-nums text-brand-navy">{display ?? value}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full accent-brand-blue" />
      {hint && <p className="text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

function RStat({ label, value, accent = "text-brand-navy", sub }) {
  return (
    <div className="bg-gray-50 border border-gray-100 rounded-sm p-3">
      <SL className="mb-1">{label}</SL>
      <p className={`text-xl font-bold tabular-nums ${accent}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function WFRow({ label, value, pctOf, color, bold = false, indent = false }) {
  const barPct = Math.max(Math.min((Math.abs(value) / Math.max(pctOf, 1)) * 100, 100), 1);
  const colorMap = { blue:"bg-brand-blue", green:"bg-emerald-500", red:"bg-red-400", amber:"bg-amber-400", navy:"bg-brand-navy", gray:"bg-gray-300" };
  return (
    <div className={`flex items-center gap-3 py-2 ${indent?"pl-4":""} ${bold?"border-t border-gray-200 pt-3 mt-1":""}`}>
      <span className={`text-xs w-36 shrink-0 ${bold?"font-semibold text-gray-800":"text-gray-500"}`}>{label}</span>
      <div className="flex-1 h-4 bg-gray-100 rounded-sm overflow-hidden">
        <div className={`h-full ${colorMap[color]||"bg-gray-300"} rounded-sm transition-all duration-500`} style={{width:`${barPct}%`}} />
      </div>
      <span className={`text-xs font-mono w-20 text-right shrink-0 ${bold?`font-bold text-sm ${color==="green"?"text-emerald-600":color==="red"?"text-red-500":"text-brand-navy"}`:color==="red"?"text-red-500 font-semibold":color==="green"?"text-emerald-600 font-semibold":color==="amber"?"text-amber-600 font-semibold":"text-gray-600"}`}>
        {value < 0 ? "-" : ""}{fmt(value)}
      </span>
    </div>
  );
}

function Verdict({ level, children }) {
  const s = {
    good: "bg-emerald-50 border-emerald-200 border-l-4 border-l-emerald-500 text-emerald-800",
    warn: "bg-amber-50 border-amber-200 border-l-4 border-l-amber-500 text-amber-800",
    bad:  "bg-red-50 border-red-200 border-l-4 border-l-red-500 text-red-800",
  };
  const icon = { good: "✓", warn: "!", bad: "✕" };
  return (
    <div className={`flex gap-3 p-4 border rounded-sm text-sm leading-relaxed ${s[level]}`}>
      <span className={`shrink-0 text-sm font-bold w-4 text-center`}>{icon[level]}</span>
      <div>{children}</div>
    </div>
  );
}

// ─── TOOL 01: Hire a cleaner ──────────────────────────────────────────────────
function HireTool({ accounts }) {
  const [wage,    setWage]    = useState(13);
  const [hrs,     setHrs]     = useState(25);
  const [genRate, setGenRate] = useState(22);

  const calc = useMemo(() => {
    const monthlyWage   = (wage * hrs * 52) / 12;
    const annualWage    = wage * hrs * 52;
    const empNI         = calcEmployerNI(annualWage) / 12;
    const monthlyRev    = (genRate * hrs * 52) / 12;
    const gross         = monthlyRev - monthlyWage - empNI;
    const tax           = gross > 0 ? gross * (accounts.taxRate + 0.09) : 0;
    const net           = gross - tax;
    const margin        = monthlyRev > 0 ? (gross / monthlyRev) * 100 : 0;
    const breakEvenRate = monthlyRev > 0
      ? ((monthlyWage + empNI) / ((hrs * 52) / 12))
      : 0;
    const payback = net > 0 ? Math.ceil(1200 / net) : null;
    return { monthlyWage, empNI, monthlyRev, gross, tax, net, margin, breakEvenRate, payback };
  }, [wage, hrs, genRate, accounts]);

  const level = calc.gross < 0 ? "bad" : calc.margin < 25 ? "warn" : "good";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <div className="space-y-4">
        <Card className="overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100"><SL>The hire</SL></div>
          <div className="p-4 space-y-5">
            <Slider label="Their hourly wage (£)" value={wage} min={12} max={22} step={0.5} onChange={setWage} display={`£${wage.toFixed(2)}/hr`} hint="National Living Wage 2026: £12.21" />
            <Slider label="Hours per week" value={hrs} min={8} max={40} step={1} onChange={setHrs} display={`${hrs} hrs/wk`} hint={`Annual wage: ${fmt(wage * hrs * 52)}`} />
            <Slider label="Revenue they generate (£/hr)" value={genRate} min={15} max={50} step={1} onChange={setGenRate} display={`£${genRate}/hr`} hint={`Monthly revenue from them: ${fmt(calc.monthlyRev)}`} />
          </div>
        </Card>
        <Alert type="gold">
          Add ~15% to base wage for holiday pay (12.07%), minimum pension (3%), and public liability insurance. The true cost is higher than the wage alone.
        </Alert>
      </div>

      <div className="space-y-4">
        {/* Answer first — verdict hero */}
        <Card className={`overflow-hidden border-t-2 ${level==="good"?"border-t-emerald-500":level==="warn"?"border-t-amber-400":"border-t-red-500"}`}>
          <div className="px-5 py-5">
            <SL className="mb-2">Your net gain from this hire</SL>
            <p className={`text-5xl font-bold tabular-nums ${calc.net>0?"text-emerald-600":"text-red-500"}`}>
              {calc.net>0?"+":"-"}{fmt(Math.abs(calc.net))}
            </p>
            <p className="text-sm text-gray-400 mt-1">per month after their wage, employer NI, and your income tax</p>
            {calc.payback && calc.net > 0 && (
              <p className="text-xs text-gray-400 mt-1">Onboarding cost (~£1,200) paid back in <span className="font-semibold text-brand-navy">{calc.payback} months</span></p>
            )}
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-3">
          <RStat label="They generate"     value={fmt(calc.monthlyRev)}              accent="text-brand-blue"  sub="per month" />
          <RStat label="Total monthly cost" value={fmt(calc.monthlyWage+calc.empNI)}  accent="text-red-500"     sub="wage + employer NI" />
          <RStat label="Gross profit"        value={fmt(calc.gross)}                   accent={calc.gross>0?"text-brand-navy":"text-red-500"} />
          <RStat label="Break-even rate"     value={`£${calc.breakEvenRate.toFixed(2)}/hr`} accent="text-amber-600" sub="minimum to cover cost" />
        </div>

        <Card className="p-4">
          <SL className="mb-3">Where the revenue goes</SL>
          <WFRow label="Revenue generated"   value={calc.monthlyRev}                 pctOf={calc.monthlyRev} color="blue" />
          <WFRow label="Their wage"           value={-calc.monthlyWage}              pctOf={calc.monthlyRev} color="red" indent />
          <WFRow label="Employer NI"          value={-calc.empNI}                    pctOf={calc.monthlyRev} color="red" indent />
          <WFRow label="Gross profit"         value={calc.gross}                     pctOf={calc.monthlyRev} color={calc.gross>0?"green":"red"} />
          <WFRow label="Your tax + NI"        value={-calc.tax}                      pctOf={calc.monthlyRev} color="amber" indent />
          <WFRow label="Net gain to you"      value={calc.net}                       pctOf={calc.monthlyRev} color="green" bold />
        </Card>

        <Verdict level={level}>
          {level==="bad" && <>At £{wage.toFixed(2)}/hr and {hrs}hrs/week, this hire costs you money. They need to generate at least <strong>£{calc.breakEvenRate.toFixed(2)}/hr</strong> to break even.</>}
          {level==="warn" && <>Profitable but only <strong>{pct(calc.margin)} margin</strong>. One quiet week wipes the gain. Raise their billable rate before committing.</>}
          {level==="good" && <>Hire them. <strong>{pct(calc.margin)} margin</strong> nets you <strong>{fmt(calc.net)}/month</strong> after all costs and your tax.</>}
        </Verdict>
      </div>
    </div>
  );
}

// ─── TOOL 02: Sole trader vs Ltd ─────────────────────────────────────────────
function StructureTool({ accounts }) {
  const [profit, setProfit] = useState(accounts.annualProfit || 45000);
  const [salary, setSalary] = useState(12570);

  const calc = useMemo(() => {
    const st  = calcSoleTax(profit);
    const ltd = calcLtdTax(profit, salary);
    const saving = ltd.takeHome - st.takeHome;
    return { st, ltd, saving };
  }, [profit, salary]);

  const level = calc.saving > 5000 ? "good" : calc.saving > 1500 ? "warn" : "bad";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <div className="space-y-4">
        <Card className="overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100"><SL>Your profit</SL></div>
          <div className="p-4 space-y-5">
            <Slider label="Annual profit (£)" value={profit} min={15000} max={200000} step={1000} onChange={setProfit} display={fmt(profit)} hint={`From your accounts: ${fmt(accounts.annualProfit||33480)}`} />
            <Slider label="Director salary if Ltd (£)" value={salary} min={12570} max={50000} step={500} onChange={setSalary} display={fmt(salary)} hint="£12,570 = personal allowance — most tax-efficient" />
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100"><SL>What limited company means in practice</SL></div>
          <div className="divide-y divide-gray-100">
            {[["Accountant cost","£1,000–£2,500/yr","text-red-500"],["Companies House","Annual accounts + £13 fee","text-gray-600"],["Payroll admin","Monthly RTI submission","text-amber-600"],["Personal liability","Limited — you're protected","text-emerald-600"],["Credibility","Ltd suffix on invoices","text-emerald-600"]].map(([l,v,c])=>(
              <div key={l} className="flex justify-between px-4 py-2.5 text-sm">
                <span className="text-gray-500">{l}</span>
                <span className={`font-semibold ${c}`}>{v}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="space-y-4">
        {/* Annual saving hero */}
        <Card className={`overflow-hidden border-t-2 ${level==="good"?"border-t-emerald-500":level==="warn"?"border-t-amber-400":"border-t-red-500"}`}>
          <div className="px-5 py-5">
            <SL className="mb-2">Annual saving — Ltd vs sole trader</SL>
            <p className={`text-5xl font-bold tabular-nums ${calc.saving>0?"text-emerald-600":"text-red-500"}`}>
              {calc.saving>0?"+":""}{fmt(calc.saving)}
            </p>
            <p className="text-sm text-gray-400 mt-1">
              {calc.saving > 2000 ? `After £1,500 accountant cost: net benefit ${fmt(calc.saving-1500)}/yr` : "Accountant cost likely wipes this saving"}
            </p>
          </div>
        </Card>

        {/* Side by side */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="overflow-hidden border-t-2 border-t-brand-blue">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100"><SL>Sole trader</SL></div>
            <div className="divide-y divide-gray-100">
              {[["Income tax",fmt(calc.st.basic+calc.st.higher),"text-red-500"],["Class 4 NI",fmt(calc.st.ni),"text-red-500"],["Total tax",fmt(calc.st.total),"text-amber-600",true],["Take-home",fmt(calc.st.takeHome),"text-emerald-600",true]].map(([l,v,c,bold])=>(
                <div key={l} className={`flex justify-between px-4 py-2.5 text-sm ${bold?"bg-gray-50":""}`}>
                  <span className={bold?"font-semibold text-gray-700":"text-gray-500"}>{l}</span>
                  <span className={`font-mono ${bold?"font-bold":""} ${c}`}>{v}</span>
                </div>
              ))}
            </div>
          </Card>
          <Card className="overflow-hidden border-t-2 border-t-emerald-500">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100"><SL>Limited company</SL></div>
            <div className="divide-y divide-gray-100">
              {[["Corp. tax",fmt(calc.ltd.corpTax),"text-red-500"],["Income tax",fmt(calc.ltd.salTax),"text-red-500"],["Dividend tax",fmt(calc.ltd.divTax),"text-red-500"],["Total tax",fmt(calc.ltd.totalTax),"text-amber-600",true],["Take-home",fmt(calc.ltd.takeHome),"text-emerald-600",true]].map(([l,v,c,bold])=>(
                <div key={l} className={`flex justify-between px-4 py-2.5 text-sm ${bold?"bg-gray-50":""}`}>
                  <span className={bold?"font-semibold text-gray-700":"text-gray-500"}>{l}</span>
                  <span className={`font-mono ${bold?"font-bold":""} ${c}`}>{v}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <Alert type="blue">
          Estimate only — not tax advice. Ask your accountant for exact figures before incorporating. Rates based on 2025/26.
        </Alert>

        <Verdict level={level}>
          {level==="bad"  && <>At {fmt(profit)} profit, stay sole trader. The saving ({fmt(Math.abs(calc.saving))}) is less than a good accountant costs. Go limited when profit consistently exceeds £50,000.</>}
          {level==="warn" && <>Borderline. You save {fmt(calc.saving)}/yr, but after accountant fees the net benefit is around {fmt(calc.saving-1500)}. Worth a conversation with an accountant, not urgent.</>}
          {level==="good" && <>Go limited. You save <strong>{fmt(calc.saving)}/yr</strong> — well above accountant costs. This is a clear win at your profit level. Get it set up.</>}
        </Verdict>
      </div>
    </div>
  );
}

// ─── TOOL 03: Should I raise my prices ────────────────────────────────────────
const PRICE_TEMPLATES = {
  gentle: {
    label: "Gentle — for long-term clients",
    subject: "A small update to our pricing",
    body: (name, oldPrice, newPrice, date) =>
`Hi ${name},

I hope you're well. I wanted to give you plenty of notice that from ${date}, my pricing will be moving from ${fmt(oldPrice)} to ${fmt(newPrice)} per visit.

This is the first increase I've made in [X months/years], and it reflects rising costs across supplies, fuel, and insurance. I've kept it as small as possible.

I really value your custom and I'm looking forward to continuing to work with you.

If you have any questions at all, please just reply to this message.

Many thanks`,
  },
  direct: {
    label: "Direct — straightforward and confident",
    subject: "Pricing update from [Month]",
    body: (name, oldPrice, newPrice, date) =>
`Hi ${name},

Just a quick note to let you know my prices are increasing from ${date}.

Your new rate will be ${fmt(newPrice)} per visit (currently ${fmt(oldPrice)}).

I've kept costs as competitive as I can while reflecting the rising cost of running the business.

Thanks for your continued support — it genuinely means a lot.

Best`,
  },
  premium: {
    label: "Premium — reframes as added value",
    subject: "An update from [Your Business Name]",
    body: (name, oldPrice, newPrice, date) =>
`Hi ${name},

I'm writing to let you know about a pricing update coming into effect from ${date}.

Your rate will move from ${fmt(oldPrice)} to ${fmt(newPrice)} per visit.

Over the past year I've invested in [better equipment / additional training / eco-friendly products] and I'm confident you'll continue to see excellent results. I keep my client base intentionally small so I can give every job the attention it deserves.

I'd love to keep working with you — please do get in touch if you'd like to chat about it.

Kind regards`,
  },
};

function PriceTool({ accounts }) {
  const [currentPrice,  setCurrentPrice]  = useState(65);
  const [risePercent,   setRisePercent]   = useState(10);
  const [clients,       setClients]       = useState(18);
  const [visitsPerMonth,setVisits]        = useState(2);
  const [expectedChurn, setChurn]         = useState(8);
  const [template,      setTemplate]      = useState("gentle");
  const [activeTab,     setActiveTab]     = useState("calculator");
  const [clientName,    setClientName]    = useState("Mrs Johnson");
  const [effectiveDate, setEffDate]       = useState("1 June 2026");
  const [copied,        setCopied]        = useState(false);
  const [bulkSent,      setBulkSent]      = useState(false);

  const calc = useMemo(() => {
    const newPrice       = currentPrice * (1 + risePercent/100);
    const clientsLost    = Math.round(clients * expectedChurn/100);
    const clientsLeft    = clients - clientsLost;
    const currentAnnual  = currentPrice * clients * visitsPerMonth * 12;
    const newAnnual      = newPrice * clientsLeft * visitsPerMonth * 12;
    const uplift         = newAnnual - currentAnnual;
    const monthlyUplift  = uplift / 12;
    const newPriceFmt    = Math.round(newPrice * 10) / 10;
    return { newPrice: newPriceFmt, clientsLost, clientsLeft, currentAnnual, newAnnual, uplift, monthlyUplift };
  }, [currentPrice, risePercent, clients, visitsPerMonth, expectedChurn]);

  const level = calc.uplift > 2000 ? "good" : calc.uplift > 0 ? "warn" : "bad";

  const tmpl = PRICE_TEMPLATES[template];
  const messageBody = tmpl.body(clientName, currentPrice, calc.newPrice, effectiveDate);

  const copyMessage = () => {
    navigator.clipboard?.writeText(messageBody).catch(()=>{});
    setCopied(true);
    setTimeout(()=>setCopied(false), 2500);
  };

  const TABS = [
    { id:"calculator", label:"Calculator" },
    { id:"templates",  label:"Message templates" },
    { id:"bulk",       label:"Bulk send guide" },
  ];

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex gap-0 border-b border-gray-200">
        {TABS.map(t => (
          <button key={t.id} onClick={()=>setActiveTab(t.id)}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-all -mb-px ${activeTab===t.id?"border-brand-blue text-brand-blue":"border-transparent text-gray-500 hover:text-gray-800"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "calculator" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="space-y-4">
            <Card className="overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100"><SL>Your current pricing</SL></div>
              <div className="p-4 space-y-5">
                <Slider label="Current price per visit (£)" value={currentPrice} min={30} max={300} step={5} onChange={setCurrentPrice} display={fmt(currentPrice)} />
                <Slider label="Price rise (%)" value={risePercent} min={3} max={25} step={1} onChange={setRisePercent} display={`+${risePercent}%`} hint={`New price: ${fmt(calc.newPrice)} per visit`} />
                <Slider label="Active clients" value={clients} min={5} max={60} step={1} onChange={setClients} display={`${clients} clients`} />
                <Slider label="Visits per month per client" value={visitsPerMonth} min={1} max={8} step={1} onChange={setVisits} display={`${visitsPerMonth} visits`} />
                <Slider label="Expected churn at this rise (%)" value={expectedChurn} min={0} max={40} step={1} onChange={setChurn} display={`${expectedChurn}%`} hint={`${calc.clientsLost} client${calc.clientsLost!==1?"s":""} might leave`} />
              </div>
            </Card>
          </div>

          <div className="space-y-4">
            <Card className={`overflow-hidden border-t-2 ${level==="good"?"border-t-emerald-500":level==="warn"?"border-t-amber-400":"border-t-red-500"}`}>
              <div className="px-5 py-5">
                <SL className="mb-2">Net annual change</SL>
                <p className={`text-5xl font-bold tabular-nums ${calc.uplift>0?"text-emerald-600":"text-red-500"}`}>
                  {calc.uplift>0?"+":""}{fmt(calc.uplift)}
                </p>
                <p className="text-sm text-gray-400 mt-1">{fmt(calc.monthlyUplift)}/month · even after losing {calc.clientsLost} client{calc.clientsLost!==1?"s":""}</p>
              </div>
            </Card>

            <div className="grid grid-cols-2 gap-3">
              <RStat label="New price"        value={fmt(calc.newPrice)}       accent="text-brand-blue" sub={`up from ${fmt(currentPrice)}`} />
              <RStat label="Clients lost"      value={`${calc.clientsLost}`}   accent={calc.clientsLost>4?"text-red-500":"text-amber-600"} sub="estimated" />
              <RStat label="Revenue now"       value={fmt(calc.currentAnnual)} accent="text-gray-500" sub="annual" />
              <RStat label="Revenue after"     value={fmt(calc.newAnnual)}     accent={calc.newAnnual>calc.currentAnnual?"text-emerald-600":"text-red-500"} sub="annual" />
            </div>

            <Verdict level={level}>
              {level==="bad"  && <>At {expectedChurn}% churn, a {risePercent}% rise loses you money. Either improve retention first, or try a smaller rise of 5–7%.</>}
              {level==="warn" && <>Profitable but modest. Even losing {calc.clientsLost} client{calc.clientsLost!==1?"s":""}, you gain {fmt(calc.uplift)}/yr. Every client who stays pays {fmt(risePercent/100*currentPrice)} more per visit.</>}
              {level==="good" && <>Raise your prices. Even losing {calc.clientsLost} client{calc.clientsLost!==1?"s":""}, you earn <strong>{fmt(calc.uplift)} more per year</strong>. The clients who leave make room for better-paying ones.</>}
            </Verdict>
          </div>
        </div>
      )}

      {activeTab === "templates" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="space-y-4">
            <Card className="overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100"><SL>Customise</SL></div>
              <div className="p-4 space-y-3">
                <div>
                  <label className="block text-xs font-bold tracking-widest uppercase text-gray-400 mb-1">Client name</label>
                  <input type="text" value={clientName} onChange={e=>setClientName(e.target.value)} className="w-full border border-gray-200 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-brand-blue" />
                </div>
                <div>
                  <label className="block text-xs font-bold tracking-widest uppercase text-gray-400 mb-1">Effective date</label>
                  <input type="text" value={effectiveDate} onChange={e=>setEffDate(e.target.value)} placeholder="e.g. 1 June 2026" className="w-full border border-gray-200 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-brand-blue" />
                </div>
                <div>
                  <label className="block text-xs font-bold tracking-widest uppercase text-gray-400 mb-2">Template style</label>
                  <div className="space-y-2">
                    {Object.entries(PRICE_TEMPLATES).map(([id, t]) => (
                      <button key={id} onClick={()=>setTemplate(id)}
                        className={`w-full text-left px-3 py-2.5 border rounded-sm text-sm transition-colors ${template===id?"bg-brand-navy text-white border-brand-navy":"bg-white text-gray-700 border-gray-200 hover:border-brand-blue"}`}>
                        <p className={`font-semibold ${template===id?"text-white":"text-gray-800"}`}>{t.label}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          </div>

          <div className="space-y-4">
            <Card className="overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <SL className="mb-0">Message preview</SL>
                  <p className="text-xs text-gray-400 mt-0.5">Subject: {tmpl.subject}</p>
                </div>
                <button onClick={copyMessage} className={`px-3 py-1.5 text-xs font-bold border rounded-sm transition-colors ${copied?"bg-emerald-50 text-emerald-700 border-emerald-200":"bg-white text-gray-600 border-gray-200 hover:border-brand-blue hover:text-brand-blue"}`}>
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <div className="p-4">
                <pre className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap font-sans">{messageBody}</pre>
              </div>
            </Card>
          </div>
        </div>
      )}

      {activeTab === "bulk" && (
        <div className="space-y-4">
          <Card className="overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100"><SL>Bulk price rise guide</SL></div>
            <div className="divide-y divide-gray-100">
              {[
                { step:"1", title:"Pick your date", body:"Give at least 4 weeks notice. Avoid holidays and busy periods. A date at the start of a month is easiest to remember." },
                { step:"2", title:"Segment your clients", body:"Send the message to your lowest-paying clients first — they have the most room for a rise. Your highest-paying, longest-standing clients last with a more personal message." },
                { step:"3", title:"Send individually, not BCC", body:"A price rise message sent to your clients' names individually converts better than a bulk email. It takes longer but the retention rate is higher." },
                { step:"4", title:"The 48-hour rule", body:"If a client hasn't responded within 48 hours, follow up with a brief: 'Just wanted to make sure you received my message about pricing — happy to chat if helpful.'" },
                { step:"5", title:"If they push back", body:"Acknowledge it: 'I completely understand — it's never a nice message to receive.' Then hold firm: 'I've kept it as small as I can while keeping the service quality the same.' Most clients accept it." },
                { step:"6", title:"Log who you've told", body:"Use the customer tracker to tag clients as 'price rise sent' and 'price rise accepted'. You'll want to know who's on the new rate before the date arrives." },
              ].map(({ step, title, body }) => (
                <div key={step} className="flex items-start gap-4 px-4 py-4">
                  <div className="w-7 h-7 rounded-full bg-brand-navy text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">{step}</div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800 mb-0.5">{title}</p>
                    <p className="text-sm text-gray-500 leading-relaxed">{body}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
          <Alert type="gold">
            Most cleaners who raise prices lose fewer clients than they expect. Industry average churn on a 10% rise is 5–8%. The clients who do leave are often your most price-sensitive — the ones who call about every invoice and push back on extras.
          </Alert>
        </div>
      )}
    </div>
  );
}

// ─── TOOL 04: Add a new service ───────────────────────────────────────────────
const SERVICE_PRESETS = [
  {
    name: "Solo window cleaner — adding gutters",
    desc: "Already visiting for windows. Gutters are a natural same-visit upsell with almost no extra travel.",
    equipCost: 200, jobsPerMonth: 8, pricePerJob: 90, addedHrs: 1.5,
    existingRev: 3200,
  },
  {
    name: "Residential cleaner — adding commercial",
    desc: "Moving into office cleaning in the evenings or early mornings to fill dead time.",
    equipCost: 0, jobsPerMonth: 4, pricePerJob: 180, addedHrs: 4,
    existingRev: 4800,
  },
  {
    name: "General cleaner — adding carpet cleaning",
    desc: "Buying a carpet cleaning machine and offering it as an add-on at regular cleans.",
    equipCost: 1200, jobsPerMonth: 6, pricePerJob: 80, addedHrs: 1.5,
    existingRev: 4200,
  },
  {
    name: "Part-time cleaner — going full-time",
    desc: "Currently 3 days/week. Modelling what full-time looks like with a full client book.",
    equipCost: 0, jobsPerMonth: 12, pricePerJob: 70, addedHrs: 2,
    existingRev: 2100,
  },
  {
    name: "Commercial cleaner — adding exterior",
    desc: "Adding window rounds and pressure washing to existing commercial clients.",
    equipCost: 800, jobsPerMonth: 5, pricePerJob: 150, addedHrs: 3,
    existingRev: 7200,
  },
];

function ServiceTool({ accounts }) {
  const [equipCost,    setEquipCost]   = useState(800);
  const [jobsPerMonth, setJobs]        = useState(6);
  const [pricePerJob,  setPrice]       = useState(80);
  const [addedHrs,     setHrs]         = useState(1.5);
  const [existingRev,  setExisting]    = useState(Math.round((accounts.ytdIncome/12)/100)*100 || 4000);
  const [activePreset, setActivePreset]= useState(null);

  const loadPreset = (i) => {
    const p = SERVICE_PRESETS[i];
    setEquipCost(p.equipCost);
    setJobs(p.jobsPerMonth);
    setPrice(p.pricePerJob);
    setHrs(p.addedHrs);
    setExisting(p.existingRev);
    setActivePreset(i);
  };

  const calc = useMemo(() => {
    const monthlyRev    = jobsPerMonth * pricePerJob;
    const annualRev     = monthlyRev * 12;
    const annualProfit  = annualRev * (1 - accounts.taxRate - 0.09) * 0.65;
    const monthlyHrs    = jobsPerMonth * addedHrs;
    const effectiveRate = addedHrs > 0 ? pricePerJob / addedHrs : 0;
    const paybackMonths = equipCost > 0 && monthlyRev > 0 ? Math.ceil(equipCost / (monthlyRev * 0.65)) : 0;
    const newTotalRev   = existingRev + monthlyRev;
    const aiaRelief     = equipCost * accounts.taxRate;
    const netEquipCost  = equipCost - aiaRelief;
    return { monthlyRev, annualRev, annualProfit, monthlyHrs, effectiveRate, paybackMonths, newTotalRev, aiaRelief, netEquipCost };
  }, [equipCost, jobsPerMonth, pricePerJob, addedHrs, existingRev, accounts]);

  const level = equipCost === 0 ? "good" : calc.paybackMonths <= 4 ? "good" : calc.paybackMonths <= 9 ? "warn" : "bad";

  return (
    <div className="space-y-5">
      {/* Preset businesses */}
      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <SL>Play with a mock business scenario</SL>
          <p className="text-xs text-gray-400 mt-0.5">Tap to load a preset — see how this decision would look for a business like yours</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-gray-100">
          {SERVICE_PRESETS.map((p, i) => (
            <button key={i} onClick={() => loadPreset(i)}
              className={`text-left p-4 transition-colors ${activePreset===i?"bg-brand-navy text-white":"bg-white hover:bg-gray-50"}`}>
              <p className={`text-sm font-semibold mb-1 ${activePreset===i?"text-white":"text-gray-800"}`}>{p.name}</p>
              <p className={`text-xs leading-relaxed ${activePreset===i?"text-brand-skyblue":"text-gray-400"}`}>{p.desc}</p>
              <p className={`text-xs font-bold mt-2 ${activePreset===i?"text-brand-skyblue":"text-brand-blue"}`}>
                {fmt(p.jobsPerMonth*p.pricePerJob)}/mo new revenue
              </p>
            </button>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="space-y-4">
          <Card className="overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100"><SL>Adjust the numbers</SL></div>
            <div className="p-4 space-y-5">
              <Slider label="Equipment cost (£)" value={equipCost} min={0} max={5000} step={50} onChange={v=>{setEquipCost(v);setActivePreset(null);}} display={equipCost===0?"No equipment needed":fmt(equipCost)} hint={equipCost>0?`AIA tax relief saves ${fmt(calc.aiaRelief)} — effective cost ${fmt(calc.netEquipCost)}`:undefined} />
              <Slider label="Jobs per month" value={jobsPerMonth} min={1} max={25} step={1} onChange={v=>{setJobs(v);setActivePreset(null);}} display={`${jobsPerMonth} jobs`} />
              <Slider label="Price per job (£)" value={pricePerJob} min={30} max={400} step={5} onChange={v=>{setPrice(v);setActivePreset(null);}} display={fmt(pricePerJob)} hint={`${fmt(calc.effectiveRate)}/hr effective rate`} />
              <Slider label="Hours per job" value={addedHrs} min={0.5} max={8} step={0.5} onChange={v=>{setHrs(v);setActivePreset(null);}} display={`${addedHrs}hrs`} hint={`${calc.monthlyHrs.toFixed(1)} extra hrs/month`} />
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className={`overflow-hidden border-t-2 ${level==="good"?"border-t-emerald-500":level==="warn"?"border-t-amber-400":"border-t-red-500"}`}>
            <div className="px-5 py-5">
              <SL className="mb-2">New monthly revenue</SL>
              <p className="text-5xl font-bold tabular-nums text-brand-navy">{fmt(calc.monthlyRev)}</p>
              <p className="text-sm text-gray-400 mt-1">{fmt(calc.annualRev)}/yr · your total business becomes {fmt(calc.newTotalRev)}/mo</p>
            </div>
          </Card>

          <div className="grid grid-cols-2 gap-3">
            <RStat label="Annual profit (est.)" value={fmt(calc.annualProfit)} accent="text-emerald-600" sub="after tax" />
            <RStat label="Equipment payback"    value={calc.paybackMonths>0?`${calc.paybackMonths} months`:"No cost"} accent={calc.paybackMonths<=4?"text-emerald-600":calc.paybackMonths<=9?"text-amber-600":"text-red-500"} />
            <RStat label="Rate per hour"         value={`£${Math.round(calc.effectiveRate)}/hr`} accent="text-brand-navy" />
            <RStat label="Extra hours/month"     value={`${calc.monthlyHrs.toFixed(1)} hrs`} accent="text-brand-navy" />
          </div>

          <Verdict level={level}>
            {level==="good" && equipCost===0 && <>Zero-risk add-on. No equipment needed — {fmt(calc.annualRev)} in new annual revenue for something you can offer immediately.</>}
            {level==="good" && equipCost>0   && <>Worth it. Equipment pays for itself in <strong>{calc.paybackMonths} months</strong>. After that it's {fmt(calc.monthlyRev)}/month in pure additional revenue.</>}
            {level==="warn"  && <>Reasonable investment — {calc.paybackMonths}-month payback. Make sure you have the client demand for {jobsPerMonth} jobs/month before buying.</>}
            {level==="bad"   && <>{calc.paybackMonths} months to break even is high risk. Either raise the price per job or find more clients before committing to equipment.</>}
          </Verdict>
        </div>
      </div>
    </div>
  );
}

// ─── TOOL 05: Most valuable hour ─────────────────────────────────────────────
const DEFAULT_SERVICES = [
  { id:1, name:"Regular clean",   jobs:12, price:65,  hrs:2.0, color:"bg-emerald-500" },
  { id:2, name:"Deep clean",      jobs:3,  price:120, hrs:3.5, color:"bg-brand-blue"  },
  { id:3, name:"Commercial",      jobs:4,  price:150, hrs:4.0, color:"bg-brand-navy"  },
  { id:4, name:"Window clean",    jobs:6,  price:65,  hrs:1.5, color:"bg-amber-500"   },
  { id:5, name:"Oven clean",      jobs:2,  price:65,  hrs:1.5, color:"bg-orange-500"  },
];

function MostValuableHourTool({ accounts }) {
  const [services, setServices] = useState(DEFAULT_SERVICES);
  const [editing, setEditing]   = useState(null);

  const updateService = (id, field, val) =>
    setServices(prev => prev.map(s => s.id===id ? {...s,[field]:val} : s));

  const addService = () =>
    setServices(prev => [...prev, { id: Date.now(), name:"New service", jobs:2, price:80, hrs:2, color:"bg-gray-400" }]);

  const removeService = (id) =>
    setServices(prev => prev.filter(s => s.id !== id));

  const ranked = useMemo(() => {
    return [...services]
      .filter(s => s.jobs > 0 && s.hrs > 0)
      .map(s => ({
        ...s,
        ratePerHr:   s.price / s.hrs,
        monthlyRev:  s.jobs * s.price,
        monthlyHrs:  s.jobs * s.hrs,
      }))
      .sort((a,b) => b.ratePerHr - a.ratePerHr);
  }, [services]);

  const totalRev  = ranked.reduce((s,r)=>s+r.monthlyRev, 0);
  const totalHrs  = ranked.reduce((s,r)=>s+r.monthlyHrs, 0);
  const avgRate   = totalHrs > 0 ? totalRev / totalHrs : 0;
  const top       = ranked[0];
  const bottom    = ranked[ranked.length - 1];
  const hourSwapGain = top && bottom ? (top.ratePerHr - bottom.ratePerHr) * 4 * 4 : 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {/* Left — sliders */}
      <div className="space-y-4">
        <Card className="overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <SL>Your work mix</SL>
            <button onClick={addService} className="text-xs font-bold text-brand-blue hover:underline">+ Add service</button>
          </div>
          <div className="divide-y divide-gray-100">
            {services.map(s => (
              <div key={s.id} className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${s.color}`} />
                  {editing === s.id ? (
                    <input type="text" value={s.name} onChange={e=>updateService(s.id,"name",e.target.value)}
                      onBlur={()=>setEditing(null)} autoFocus
                      className="flex-1 text-sm font-semibold text-gray-800 border-0 border-b border-brand-blue focus:outline-none bg-transparent" />
                  ) : (
                    <button onClick={()=>setEditing(s.id)} className="text-sm font-semibold text-gray-800 hover:text-brand-blue flex-1 text-left">{s.name}</button>
                  )}
                  <button onClick={()=>removeService(s.id)} className="text-gray-300 hover:text-red-400 text-xs ml-auto">✕</button>
                </div>
                <div className="space-y-3">
                  <Slider label="Jobs/month" value={s.jobs} min={0} max={25} step={1} onChange={v=>updateService(s.id,"jobs",v)} display={`${s.jobs}`} />
                  <Slider label="Price (£)"   value={s.price} min={20} max={400} step={5} onChange={v=>updateService(s.id,"price",v)} display={fmt(s.price)} />
                  <Slider label="Hours/job"   value={s.hrs} min={0.5} max={8} step={0.5} onChange={v=>updateService(s.id,"hrs",v)} display={`${s.hrs}h`} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Right — ranking */}
      <div className="space-y-4">
        <Card className="overflow-hidden border-t-2 border-t-brand-navy">
          <div className="px-4 py-3 bg-brand-navy text-white flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-widest">Ranked by actual hourly rate</p>
            <Chip color="sky">£{Math.round(avgRate)}/hr avg</Chip>
          </div>
          <div className="divide-y divide-gray-100">
            {ranked.map((r, i) => {
              const revShare = totalRev > 0 ? Math.round((r.monthlyRev/totalRev)*100) : 0;
              const hrsShare = totalHrs > 0 ? Math.round((r.monthlyHrs/totalHrs)*100) : 0;
              const above    = r.ratePerHr >= avgRate;
              const isTop    = i === 0;
              const isBottom = i === ranked.length - 1 && ranked.length > 1;
              return (
                <div key={r.id} className={`px-4 py-3 ${isTop?"bg-emerald-50/40":isBottom?"bg-red-50/30":""}`}>
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                      isTop?"bg-emerald-500 text-white":isBottom?"bg-red-400 text-white":"bg-gray-100 text-gray-600"
                    }`}>{i+1}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${r.color}`} />
                        <p className="text-sm font-semibold text-gray-800 truncate">{r.name}</p>
                        {isTop    && <Chip color="green">Best earner</Chip>}
                        {isBottom && <Chip color="red">Lowest earner</Chip>}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5 ml-4">
                        {revShare}% of revenue · {hrsShare}% of your time
                      </p>
                    </div>
                    <p className={`text-lg font-bold tabular-nums shrink-0 ${above?"text-emerald-600":"text-red-500"}`}>
                      £{Math.round(r.ratePerHr)}/hr
                    </p>
                  </div>
                  <div className="ml-10">
                    <div className="h-2.5 bg-gray-100 rounded-sm overflow-hidden">
                      <div className={`h-full ${r.color} rounded-sm transition-all duration-500`}
                        style={{ width:`${top ? (r.ratePerHr/top.ratePerHr)*100 : 100}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {top && bottom && ranked.length > 1 && (
          <Card className="p-4 border-l-4 border-l-brand-blue">
            <SL className="mb-2">The opportunity</SL>
            <p className="text-sm text-gray-700 leading-relaxed">
              <strong>{top.name}</strong> earns you <strong>£{Math.round(top.ratePerHr)}/hr</strong>. {bottom.name} earns £{Math.round(bottom.ratePerHr)}/hr.
              If you replaced 4 hours of {bottom.name} with {top.name} each week, you'd earn an extra <strong className="text-emerald-600">{fmt(hourSwapGain)}/month</strong> for the same hours worked.
            </p>
          </Card>
        )}

        <div className="grid grid-cols-3 gap-3">
          <RStat label="Monthly revenue" value={fmt(totalRev)}            accent="text-brand-navy" />
          <RStat label="Monthly hours"   value={`${totalHrs.toFixed(0)}hrs`} accent="text-brand-navy" />
          <RStat label="Average rate"    value={`£${Math.round(avgRate)}/hr`} accent="text-brand-blue" />
        </div>
      </div>
    </div>
  );
}

// ─── TOOL 06: Org chart builder ───────────────────────────────────────────────
const ROLE_DEFS = {
  owner:   { label:"Owner / Director", color:"border-t-brand-navy",  avatarBg:"bg-brand-navy/10 text-brand-navy",    rate:0     },
  manager: { label:"Operations Mgr",   color:"border-t-brand-blue",  avatarBg:"bg-blue-100 text-brand-blue",         rate:18    },
  lead:    { label:"Team Lead",         color:"border-t-emerald-500", avatarBg:"bg-emerald-100 text-emerald-700",     rate:15    },
  cleaner: { label:"Cleaner",           color:"border-t-amber-500",   avatarBg:"bg-amber-100 text-amber-700",         rate:12.50 },
  admin:   { label:"Admin / Office",   color:"border-t-purple-400",  avatarBg:"bg-purple-100 text-purple-700",       rate:14    },
  vacant:  { label:"Vacant slot",       color:"border-dashed border-gray-300", avatarBg:"bg-gray-100 text-gray-400", rate:12.50 },
};

const ORG_PRESETS = [
  {
    name:"Solo operator",    revenue:"£3–5k/mo",
    tiers:[[{id:1,type:"owner",  name:"You",     hrs:40,rate:0    }]],
  },
  {
    name:"First hire",       revenue:"£5–8k/mo",
    tiers:[[{id:1,type:"owner",  name:"You",     hrs:40,rate:0    }],
           [{id:2,type:"cleaner",name:"Cleaner", hrs:25,rate:12.50}]],
  },
  {
    name:"Small team",       revenue:"£8–12k/mo",
    tiers:[[{id:1,type:"owner",  name:"You",       hrs:35,rate:0    }],
           [{id:2,type:"cleaner",name:"Cleaner 1",  hrs:40,rate:13  },
            {id:3,type:"cleaner",name:"Cleaner 2",  hrs:40,rate:13  }]],
  },
  {
    name:"Growing operation",revenue:"£15–22k/mo",
    tiers:[[{id:1,type:"owner",  name:"You",       hrs:30,rate:0    }],
           [{id:2,type:"lead",   name:"Team Lead", hrs:40,rate:15  }],
           [{id:3,type:"cleaner",name:"Cleaner 1",  hrs:40,rate:13  },
            {id:4,type:"cleaner",name:"Cleaner 2",  hrs:40,rate:13  },
            {id:5,type:"cleaner",name:"Cleaner 3",  hrs:40,rate:13  }]],
  },
  {
    name:"Full company",     revenue:"£30k+/mo",
    tiers:[[{id:1,type:"owner",  name:"You",       hrs:20,rate:0    }],
           [{id:2,type:"manager",name:"Ops Manager",hrs:40,rate:18  }],
           [{id:3,type:"lead",   name:"Lead A",    hrs:40,rate:15  },
            {id:4,type:"lead",   name:"Lead B",    hrs:40,rate:15  }],
           [{id:5,type:"cleaner",name:"C1",         hrs:40,rate:13  },
            {id:6,type:"cleaner",name:"C2",         hrs:40,rate:13  },
            {id:7,type:"cleaner",name:"C3",         hrs:40,rate:13  },
            {id:8,type:"cleaner",name:"C4",         hrs:40,rate:13  }]],
  },
];

let _oid = 100;
const oid = () => ++_oid;

function monthlyCost(p) { return (p.rate * p.hrs * 52) / 12; }
function empNIMonthly(p){ return Math.max(0,(p.rate*p.hrs*52-9100)*0.138/12); }
function totalCostPerson(p){ return monthlyCost(p) + empNIMonthly(p); }
function revNeeded(p)   { return totalCostPerson(p) / 0.65; }

function OrgTool({ accounts }) {
  const [tiers,      setTiers]      = useState(ORG_PRESETS[1].tiers.map(tier=>tier.map(p=>({...p}))));
  const [activeView, setActiveView] = useState("chart");
  const [selected,   setSelected]   = useState(null);
  const [addingTo,   setAddingTo]   = useState(null); // tier index

  const allPeople   = tiers.flat();
  const staff       = allPeople.filter(p=>p.type!=="owner");
  const totalWage   = allPeople.reduce((s,p)=>s+totalCostPerson(p),0);
  const totalRevReq = staff.reduce((s,p)=>s+revNeeded(p),0);
  const headcount   = staff.length;

  const addPersonToTier = (tierIdx, type) => {
    const def = ROLE_DEFS[type];
    const newP = { id:oid(), type, name:def.label, hrs:type==="owner"?40:25, rate:def.rate };
    setTiers(prev => {
      const next = prev.map(t=>[...t]);
      next[tierIdx] = [...next[tierIdx], newP];
      return next;
    });
    setAddingTo(null);
  };

  const addNewTier = (type) => {
    const def = ROLE_DEFS[type];
    const newP = { id:oid(), type, name:def.label, hrs:25, rate:def.rate };
    setTiers(prev => [...prev, [newP]]);
    setAddingTo(null);
  };

  const removePerson = (id) => {
    setTiers(prev => prev.map(t=>t.filter(p=>p.id!==id)).filter(t=>t.length>0));
    if (selected===id) setSelected(null);
  };

  const updatePerson = (id, field, val) =>
    setTiers(prev => prev.map(t=>t.map(p=>p.id===id?{...p,[field]:val}:p)));

  const loadPreset = (i) => {
    setTiers(ORG_PRESETS[i].tiers.map(tier=>tier.map(p=>({...p}))));
    setSelected(null);
  };

  const selectedPerson = selected ? allPeople.find(p=>p.id===selected) : null;

  const orgLevel = totalRevReq === 0 ? "good" : totalRevReq < 6000 ? "good" : totalRevReq < 15000 ? "warn" : "bad";

  return (
    <div className="space-y-4">
      {/* View tabs */}
      <div className="flex gap-0 border-b border-gray-200">
        {[{id:"chart",label:"Org chart"},{id:"presets",label:"Preset structures"},{id:"finance",label:"Financial breakdown"}].map(t=>(
          <button key={t.id} onClick={()=>{setActiveView(t.id);setSelected(null);}}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-all -mb-px ${activeView===t.id?"border-brand-blue text-brand-blue":"border-transparent text-gray-500 hover:text-gray-800"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {activeView === "presets" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {ORG_PRESETS.map((p,i) => (
            <button key={i} onClick={()=>{loadPreset(i);setActiveView("chart");}}
              className="text-left border border-gray-200 rounded-sm p-4 hover:border-brand-blue hover:bg-blue-50/30 transition-colors">
              <p className="text-sm font-bold text-brand-navy mb-1">{p.name}</p>
              <p className="text-xs text-gray-400 mb-3">{p.tiers.flat().length} people · {p.tiers.length} tier{p.tiers.length!==1?"s":""}</p>
              <p className="text-sm font-semibold text-emerald-600">{p.revenue}</p>
            </button>
          ))}
        </div>
      )}

      {activeView === "chart" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Chart canvas */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-gray-50 border border-gray-200 rounded-sm p-5 overflow-x-auto">
              <div className="flex flex-col items-center gap-0 min-w-max mx-auto">
                {tiers.map((tier, ti) => (
                  <div key={ti}>
                    {ti > 0 && (
                      <div className="flex flex-col items-center">
                        <div className="w-px h-5 bg-gray-300" />
                        {tier.length > 1 && (
                          <div className="relative w-full" style={{ width:`${tier.length * 156}px`, height:2 }}>
                            <div className="absolute top-0 bg-gray-300" style={{ left:78, right:78, height:2 }} />
                          </div>
                        )}
                        {tier.length > 1 && <div className="h-5" />}
                      </div>
                    )}
                    <div className="flex gap-3 justify-center">
                      {tier.map(p => {
                        const def = ROLE_DEFS[p.type] ?? ROLE_DEFS.cleaner;
                        const cost = totalCostPerson(p);
                        const initials = p.name.split(" ").map(w=>w[0]).slice(0,2).join("").toUpperCase();
                        const isSel = selected === p.id;
                        return (
                          <div key={p.id} onClick={()=>setSelected(isSel?null:p.id)}
                            className={`w-36 border-t-2 ${def.color} border border-gray-200 rounded-sm bg-white p-3 cursor-pointer transition-all ${isSel?"ring-2 ring-brand-blue shadow-sm":""}`}>
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold mx-auto mb-2 ${def.avatarBg}`}>
                              {initials || "?"}
                            </div>
                            <p className="text-xs font-bold text-gray-700 text-center leading-tight truncate">{p.name}</p>
                            <p className="text-xs text-gray-400 text-center mt-0.5 truncate">{def.label}</p>
                            {p.type !== "owner" && (
                              <p className="text-xs font-semibold text-red-500 text-center mt-1">
                                -{fmt(cost)}/mo
                              </p>
                            )}
                          </div>
                        );
                      })}
                      {/* Add to this tier */}
                      {addingTo === ti ? (
                        <div className="w-36 border-2 border-dashed border-brand-blue rounded-sm bg-blue-50/30 p-2">
                          <p className="text-xs font-bold text-brand-blue text-center mb-2">Add role</p>
                          <div className="space-y-1">
                            {Object.entries(ROLE_DEFS).filter(([k])=>k!=="owner"&&k!=="vacant").map(([id,def])=>(
                              <button key={id} onClick={()=>addPersonToTier(ti,id)}
                                className="w-full text-xs py-1 px-2 bg-white border border-gray-200 rounded-sm hover:border-brand-blue hover:text-brand-blue text-gray-600 text-left transition-colors">
                                {def.label}
                              </button>
                            ))}
                            <button onClick={()=>setAddingTo(null)} className="w-full text-xs py-1 text-gray-400 hover:text-gray-600 text-center">Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <button onClick={()=>setAddingTo(ti)}
                          className="w-36 border-2 border-dashed border-gray-200 rounded-sm flex flex-col items-center justify-center gap-1 py-4 hover:border-brand-blue hover:text-brand-blue text-gray-300 transition-colors">
                          <span className="text-lg leading-none">+</span>
                          <span className="text-xs font-semibold">Add role</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {/* Add new tier */}
                <div className="flex flex-col items-center mt-2">
                  <div className="w-px h-5 bg-gray-300" />
                  {addingTo === "new" ? (
                    <div className="border-2 border-dashed border-brand-blue rounded-sm bg-blue-50/30 p-3 w-52">
                      <p className="text-xs font-bold text-brand-blue text-center mb-2">Add a new tier</p>
                      <div className="space-y-1">
                        {Object.entries(ROLE_DEFS).filter(([k])=>k!=="owner"&&k!=="vacant").map(([id,def])=>(
                          <button key={id} onClick={()=>addNewTier(id)}
                            className="w-full text-xs py-1 px-2 bg-white border border-gray-200 rounded-sm hover:border-brand-blue hover:text-brand-blue text-gray-600 text-left transition-colors">
                            {def.label}
                          </button>
                        ))}
                        <button onClick={()=>setAddingTo(null)} className="w-full text-xs py-1 text-gray-400 hover:text-gray-600 text-center">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={()=>setAddingTo("new")}
                      className="px-4 py-2 border-2 border-dashed border-gray-200 rounded-sm text-xs font-bold text-gray-400 hover:border-brand-blue hover:text-brand-blue transition-colors">
                      + Add tier below
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Summary bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <RStat label="Total wage bill"    value={fmt(totalWage)}   accent={totalWage>8000?"text-red-500":"text-brand-navy"} sub="per month" />
              <RStat label="Revenue to sustain" value={fmt(totalRevReq)} accent="text-brand-navy" sub="break-even" />
              <RStat label="Headcount"           value={`${headcount} staff`} accent="text-brand-navy" />
              <RStat label="Avg cost/head"       value={headcount>0?fmt(totalWage/headcount):"—"} accent="text-gray-600" sub="per month" />
            </div>

            <Verdict level={orgLevel}>
              {totalRevReq===0 && <>Solo operator — no wage overhead. All revenue is yours.</>}
              {totalRevReq>0 && totalRevReq<6000  && <>Your team needs to generate <strong>{fmt(totalRevReq)}/month</strong> to cover wages — a realistic target. Each person needs roughly {fmt(totalRevReq/Math.max(headcount,1))}/month in jobs.</>}
              {totalRevReq>=6000 && totalRevReq<15000 && <>This structure needs <strong>{fmt(totalRevReq)}/month</strong>. Achievable, but make sure you have the client pipeline before all {headcount} hires are in place.</>}
              {totalRevReq>=15000 && <>This is a significant operation — <strong>{fmt(totalRevReq)}/month</strong> needed. Only viable with commercial contracts or a very full residential book in place.</>}
            </Verdict>
          </div>

          {/* Right — selected person editor */}
          <div className="space-y-4">
            {selectedPerson ? (
              <Card className="overflow-hidden">
                <div className="px-4 py-3 bg-brand-navy text-white flex items-center justify-between">
                  <p className="text-sm font-bold">{selectedPerson.name}</p>
                  <button onClick={()=>{removePerson(selectedPerson.id);}} className="text-xs text-red-300 hover:text-red-100 font-bold">Remove</button>
                </div>
                <div className="p-4 space-y-4">
                  <div>
                    <label className="block text-xs font-bold tracking-widest uppercase text-gray-400 mb-1">Name</label>
                    <input type="text" value={selectedPerson.name} onChange={e=>updatePerson(selectedPerson.id,"name",e.target.value)}
                      className="w-full border border-gray-200 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-brand-blue" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold tracking-widest uppercase text-gray-400 mb-1">Role</label>
                    <select value={selectedPerson.type} onChange={e=>updatePerson(selectedPerson.id,"type",e.target.value)}
                      className="w-full border border-gray-200 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-brand-blue">
                      {Object.entries(ROLE_DEFS).map(([id,def])=>(
                        <option key={id} value={id}>{def.label}</option>
                      ))}
                    </select>
                  </div>
                  {selectedPerson.type !== "owner" && (
                    <>
                      <Slider label="Hourly rate (£)" value={selectedPerson.rate} min={11} max={25} step={0.5} onChange={v=>updatePerson(selectedPerson.id,"rate",v)} display={`£${selectedPerson.rate.toFixed(2)}/hr`} />
                      <Slider label="Hours per week" value={selectedPerson.hrs} min={8} max={40} step={1} onChange={v=>updatePerson(selectedPerson.id,"hrs",v)} display={`${selectedPerson.hrs}hrs`} />
                      <div className="bg-gray-50 border border-gray-100 rounded-sm divide-y divide-gray-100 text-sm">
                        {[
                          ["Monthly wage",      fmt(monthlyCost(selectedPerson))],
                          ["Employer NI",       fmt(empNIMonthly(selectedPerson))],
                          ["Total monthly cost",fmt(totalCostPerson(selectedPerson))],
                          ["Revenue they need", fmt(revNeeded(selectedPerson))],
                        ].map(([l,v])=>(
                          <div key={l} className="flex justify-between px-3 py-2 text-xs">
                            <span className="text-gray-400">{l}</span>
                            <span className="font-semibold text-gray-800">{v}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </Card>
            ) : (
              <Card className="p-5 text-center">
                <p className="text-sm text-gray-400 mb-1">Click any role card to edit</p>
                <p className="text-xs text-gray-400">Change name, role, hours, and rate. Revenue needed updates automatically.</p>
              </Card>
            )}

            <Alert type="gold">
              Revenue needed = what each person must generate to justify their cost at a 65% gross margin. This assumes they're billing at your average job rate, not just covering their wage.
            </Alert>
          </div>
        </div>
      )}

      {activeView === "finance" && (
        <Card className="overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100"><SL>Full cost breakdown</SL></div>
          {/* Header */}
          <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-gray-50 text-xs font-bold tracking-widests uppercase text-gray-400 border-b border-gray-100">
            <span className="col-span-4">Person</span>
            <span className="col-span-2 text-right">Wage/mo</span>
            <span className="col-span-2 text-right">Emp. NI</span>
            <span className="col-span-2 text-right">Total</span>
            <span className="col-span-2 text-right">Rev. needed</span>
          </div>
          <div className="divide-y divide-gray-100">
            {allPeople.map(p=>{
              const def  = ROLE_DEFS[p.type]??ROLE_DEFS.cleaner;
              const wage = monthlyCost(p);
              const ni   = empNIMonthly(p);
              const tot  = totalCostPerson(p);
              const rev  = revNeeded(p);
              return (
                <div key={p.id} className="grid grid-cols-12 gap-2 px-4 py-3 text-sm items-center">
                  <div className="col-span-4">
                    <p className="font-semibold text-gray-800">{p.name}</p>
                    <p className="text-xs text-gray-400">{def.label} · £{p.rate}/hr · {p.hrs}h/wk</p>
                  </div>
                  <span className="col-span-2 text-right font-mono text-red-500">{wage>0?`-${fmt(wage)}`:"—"}</span>
                  <span className="col-span-2 text-right font-mono text-red-500">{ni>0?`-${fmt(ni)}`:"—"}</span>
                  <span className="col-span-2 text-right font-mono font-semibold text-red-500">{tot>0?`-${fmt(tot)}`:"Owner"}</span>
                  <span className="col-span-2 text-right font-mono font-semibold text-emerald-600">{rev>0?fmt(rev):"—"}</span>
                </div>
              );
            })}
          </div>
          {/* Totals row */}
          <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-gray-50 border-t border-gray-200 text-sm font-bold">
            <span className="col-span-4 text-brand-navy">Total</span>
            <span className="col-span-2 text-right font-mono text-red-500">-{fmt(allPeople.reduce((s,p)=>s+monthlyCost(p),0))}</span>
            <span className="col-span-2 text-right font-mono text-red-500">-{fmt(allPeople.reduce((s,p)=>s+empNIMonthly(p),0))}</span>
            <span className="col-span-2 text-right font-mono text-red-500">-{fmt(totalWage)}</span>
            <span className="col-span-2 text-right font-mono text-emerald-600">{fmt(totalRevReq)}</span>
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── Tool nav ─────────────────────────────────────────────────────────────────
const TOOLS = [
  { id:"hire",      label:"Hire a cleaner",      num:"01", q:"Will this hire make me money?" },
  { id:"structure", label:"Sole trader vs Ltd",  num:"02", q:"Should I go limited?" },
  { id:"prices",    label:"Raise my prices",     num:"03", q:"How much, when, and how?" },
  { id:"service",   label:"Add a new service",   num:"04", q:"Is it worth the investment?" },
  { id:"hour",      label:"Most valuable hour",  num:"05", q:"Which work pays best per hour?" },
  { id:"org",       label:"Org chart",           num:"06", q:"Design my business structure" },
];

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export default function BusinessLabTab({ accountsData, onNavigate }) {
  const accounts = { ...DEFAULT_ACCOUNTS, ...(accountsData ?? {}) };
  const [activeTool, setActiveTool] = useState("hire");
  const active = TOOLS.find(t => t.id === activeTool);

  return (
    <div className="flex flex-col h-full bg-gray-50/50">

      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-start justify-between">
        <div>
          <p className="text-xs font-bold tracking-widest uppercase text-brand-blue mb-0.5">Cadi</p>
          <h2 className="text-2xl font-bold text-brand-navy">Business Lab</h2>
          <p className="text-xs text-gray-400 mt-0.5">Six tools that answer the questions every growing cleaner actually has</p>
        </div>
        <div className="hidden sm:flex items-center gap-2 px-3 py-2 bg-brand-navy/5 border border-brand-navy/10 rounded-sm">
          <span className={`w-2 h-2 rounded-full shrink-0 ${accountsData?"bg-emerald-400 animate-pulse":"bg-gray-300"}`} />
          <div>
            <p className="text-xs font-bold text-brand-navy">{accountsData?"Live from accounts":"Demo data"}</p>
            <p className="text-xs text-gray-400">{fmt(accounts.ytdIncome)}/yr · {Math.round(accounts.taxRate*100)}% tax</p>
          </div>
        </div>
      </div>

      {/* Tool selector */}
      <div className="bg-white border-b border-gray-200 overflow-x-auto">
        <div className="flex gap-0 min-w-max px-0">
          {TOOLS.map(t => (
            <button key={t.id} onClick={()=>setActiveTool(t.id)}
              className={`flex items-center gap-2 px-4 py-3.5 text-sm font-semibold border-b-2 transition-all -mb-px whitespace-nowrap ${
                activeTool===t.id ? "border-brand-blue text-brand-blue" : "border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300"
              }`}>
              <span className="hidden sm:inline">{t.label}</span>
              <span className="sm:hidden">{t.label.split(" ")[0]}</span>
              <span className={`text-xs font-mono ${activeTool===t.id?"text-brand-skyblue":"text-gray-300"}`}>{t.num}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Active tool question */}
      <div className="bg-brand-navy/5 border-b border-brand-navy/10 px-6 py-2.5 hidden lg:block">
        <p className="text-xs text-gray-500">
          <span className="font-semibold text-brand-navy not-italic">{active?.label}</span>
          {" · "}
          <span className="italic">"{active?.q}"</span>
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 lg:p-6">
        {activeTool==="hire"      && <HireTool           accounts={accounts} />}
        {activeTool==="structure" && <StructureTool       accounts={accounts} />}
        {activeTool==="prices"    && <PriceTool           accounts={accounts} />}
        {activeTool==="service"   && <ServiceTool         accounts={accounts} />}
        {activeTool==="hour"      && <MostValuableHourTool accounts={accounts} />}
        {activeTool==="org"       && <OrgTool             accounts={accounts} />}
      </div>

      {/* Footer */}
      <div className="bg-white border-t border-gray-100 px-6 py-2.5 flex items-center justify-between">
        <p className="text-xs text-gray-400">Estimates only — not financial or tax advice. 2025/26 UK rates.</p>
        <button onClick={()=>onNavigate?.("accounts")} className="text-xs text-brand-blue font-semibold hover:underline">View live accounts →</button>
      </div>
    </div>
  );
}
