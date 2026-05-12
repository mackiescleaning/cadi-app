export default function ClientCompliance({ showToast }) {
  const DOCS = [
    {
      category: 'Insurance',
      items: [
        { name: 'Public Liability Insurance',     value: '£5,000,000',  expiry: '2027-03-31', status: 'current', provider: 'Axa Business Insurance' },
        { name: 'Employer\'s Liability Insurance', value: '£10,000,000', expiry: '2027-03-31', status: 'current', provider: 'Axa Business Insurance' },
      ],
    },
    {
      category: 'Staff Vetting',
      items: [
        { name: 'DBS Check — Lead Operative',     value: 'Enhanced',   expiry: '2027-01-14', status: 'current', provider: 'Disclosure & Barring Service' },
        { name: 'Right to Work verification',     value: 'Verified',   expiry: null,         status: 'current', provider: 'Home Office Share Code' },
      ],
    },
    {
      category: 'Health & Safety',
      items: [
        { name: 'COSHH Assessment — School',      value: 'Completed',  expiry: '2026-09-30', status: 'current', provider: 'Internal' },
        { name: 'Risk Assessment — Riverside',    value: 'Site-specific', expiry: '2026-09-30', status: 'current', provider: 'Internal' },
        { name: 'Method Statement',               value: 'v3.1',       expiry: null,         status: 'current', provider: 'Britannia FM' },
      ],
    },
    {
      category: 'Accreditations',
      items: [
        { name: 'Safe Contractor Approved',       value: 'Active',     expiry: '2026-12-31', status: 'current', provider: 'Alcumus' },
        { name: 'BICSc Operator Certificate',     value: 'Held',       expiry: null,         status: 'current', provider: 'BICS' },
      ],
    },
  ];

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white shrink-0">✓</div>
        <div>
          <div className="font-bold text-emerald-800 text-sm">All compliance documents current</div>
          <div className="text-xs text-emerald-600">Last verified 09 May 2026</div>
        </div>
      </div>

      {DOCS.map(({ category, items }) => (
        <div key={category} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <div className="text-xs font-black uppercase tracking-widest text-gray-400">{category}</div>
          </div>
          <div className="divide-y divide-gray-50">
            {items.map(({ name, value, expiry, provider }) => (
              <div key={name} className="px-5 py-4 flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 text-xs font-bold shrink-0 mt-0.5">✓</div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-[#010a4f]">{name}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{provider}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs font-bold text-[#010a4f]">{value}</div>
                  {expiry && <div className="text-[10px] text-gray-400 mt-0.5">Exp: {expiry}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="bg-[#f8faff] rounded-2xl border border-[#99c5ff]/20 p-5 text-center">
        <div className="text-3xl mb-3">📋</div>
        <div className="font-bold text-[#010a4f] mb-1">Full audit pack</div>
        <p className="text-xs text-gray-400 mb-4">
          Download a complete compliance pack for Riverside Primary — includes all certificates, assessments and DBS documentation.
        </p>
        <button
          onClick={() => showToast('download Riverside Primary compliance audit pack')}
          className="px-6 py-3 rounded-xl bg-[#010a4f] text-white text-sm font-bold hover:bg-[#1f48ff] transition-colors"
        >
          Download audit pack (demo)
        </button>
      </div>
    </div>
  );
}
