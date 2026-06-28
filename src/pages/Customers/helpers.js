import { supabase } from "../../lib/supabase";

export const JOB_TYPES = [
  { id: "all",            label: "All customers",   color: "gray"    },
  { id: "regular",        label: "Regular clean",   color: "emerald" },
  { id: "deep",           label: "Deep clean",      color: "blue"    },
  { id: "end-of-tenancy", label: "End of tenancy",  color: "purple"  },
  { id: "commercial",     label: "Commercial",       color: "blue"    },
  { id: "windows",        label: "Window clean",    color: "sky"     },
  { id: "gutter",         label: "Gutter clean",    color: "orange"  },
  { id: "roof",           label: "Roof clean",      color: "orange"  },
  { id: "carpet",         label: "Carpet clean",    color: "amber"   },
  { id: "oven",           label: "Oven clean",      color: "red"     },
  { id: "exterior",       label: "Exterior / pressure wash", color: "orange" },
  { id: "one-off",        label: "One-off",         color: "gray"    },
];

export function generateSuggestions(customer) {
  const suggestions = [];
  const services = customer.services.map(s => s.type);
  const hasLastJob = Boolean(customer.lastJobDate);
  const daysSinceLastJob = hasLastJob
    ? Math.floor((Date.now() - new Date(customer.lastJobDate)) / 86400000)
    : null;
  const totalSpend = customer.services.reduce((s, j) => s + j.price, 0);

  if (services.includes("regular") && !services.includes("deep")) {
    suggestions.push({
      type: "upsell",
      title: "Deep clean upgrade",
      body: `${customer.name.split(" ")[0]} has had ${customer.services.filter(s=>s.type==="regular").length} regular cleans. A quarterly deep clean would add ~£80–£120 per visit.`,
      action: "Suggest deep clean",
      value: 100,
      priority: "high",
    });
  }

  if (services.includes("regular") && !services.includes("oven")) {
    suggestions.push({
      type: "upsell",
      title: "Add oven clean",
      body: "Regular clean customers rarely book oven cleans separately — a quick offer at the next visit converts well. Most customers say yes when asked in person.",
      action: "Offer oven clean",
      value: 65,
      priority: "medium",
    });
  }

  if ((services.includes("windows") || services.includes("exterior")) && !services.includes("gutter")) {
    suggestions.push({
      type: "upsell",
      title: "Add gutter clean",
      body: "Already visiting for exterior work — gutters are a natural upsell. Most customers don't think to ask but immediately say yes when prompted.",
      action: "Offer gutter clean",
      value: 100,
      priority: "medium",
    });
  }

  if (services.includes("gutter") && !services.includes("roof")) {
    const daysSinceGutter = Math.floor((Date.now() - new Date(customer.services.find(s=>s.type==="gutter")?.date ?? customer.lastJobDate)) / 86400000);
    if (daysSinceGutter > 180) {
      suggestions.push({
        type: "upsell",
        title: "Roof moss treatment due",
        body: "If gutters are filling fast, roof moss is likely the cause. A treatment now prevents the problem recurring — and is a significant upsell.",
        action: "Suggest roof treatment",
        value: 250,
        priority: "high",
      });
    }
  }

  if (services.includes("regular") && !services.includes("carpet")) {
    suggestions.push({
      type: "upsell",
      title: "Add carpet cleaning",
      body: "Regular domestic customers rarely think to ask — a well-timed \"shall we do the carpets while we're there?\" converts at ~40%.",
      action: "Offer carpet add-on",
      value: 40,
      priority: "medium",
    });
  }

  if (services.includes("windows") && !services.includes("exterior")) {
    suggestions.push({
      type: "crosssell",
      title: "Cross-sell exterior services",
      body: `Already visiting for windows — driveway or patio pressure wash is a natural add-on. Saves them a separate booking and adds £80–£150.`,
      action: "Add exterior services",
      value: 110,
      priority: "high",
    });
  }

  if (services.includes("end-of-tenancy") && !services.includes("regular")) {
    suggestions.push({
      type: "crosssell",
      title: "Convert to regular customer",
      body: "End of tenancy customers often move to a new property. Reach out about ongoing regular cleans — capture them before a competitor does.",
      action: "Send regular clean offer",
      value: 65,
      priority: "high",
    });
  }

  if (services.includes("commercial") && !services.includes("windows")) {
    suggestions.push({
      type: "crosssell",
      title: "Add window contract",
      body: "Commercial clients booking regular office cleans are prime candidates for a monthly window contract. Often overlooked by other cleaners.",
      action: "Propose window contract",
      value: 120,
      priority: "medium",
    });
  }

  if (totalSpend > 500 && !customer.tags.includes("vip")) {
    suggestions.push({
      type: "relationship",
      title: "Mark as VIP — loyalty reward",
      body: `£${totalSpend.toLocaleString()} lifetime spend. A small loyalty gesture (priority booking, anniversary discount) builds long-term retention.`,
      action: "Send loyalty message",
      value: 0,
      priority: "medium",
    });
  }

  if (hasLastJob && customer.frequency === "one-off" && daysSinceLastJob > 30) {
    suggestions.push({
      type: "reminder",
      title: "Follow up on one-off job",
      body: `Last job was ${daysSinceLastJob} days ago. One-off customers who don't hear back within 6 weeks are 3× more likely to use someone else next time.`,
      action: "Send follow-up",
      value: 65,
      priority: "high",
    });
  }

  if (hasLastJob && daysSinceLastJob > 90) {
    suggestions.push({
      type: "winback",
      title: `Lapsed — ${daysSinceLastJob} days since last job`,
      body: "Win-back messages sent within 90–180 days have a ~35% success rate. Beyond 180 days it drops sharply. Act now.",
      action: "Send win-back",
      value: 65,
      priority: daysSinceLastJob > 180 ? "urgent" : "high",
    });
  }

  return suggestions.sort((a, b) => {
    const order = { urgent: 0, high: 1, medium: 2, low: 3 };
    const pri = order[a.priority] - order[b.priority];
    return pri !== 0 ? pri : (b.value || 0) - (a.value || 0);
  });
}

export function generateMessage(customer, messageType) {
  const first = customer.name.split(" ")[0];
  const lastService = customer.services[0];
  const daysSince = customer.lastJobDate
    ? Math.floor((Date.now() - new Date(customer.lastJobDate)) / 86400000)
    : null;

  const templates = {
    winback: {
      subject: `We miss you, ${first} — book your next clean`,
      body: `Hi ${first},\n\nIt's been a while since your last clean with us${lastService ? ` (${lastService.label} back in ${new Date(customer.lastJobDate).toLocaleDateString("en-GB", { month: "long", year: "numeric" })})` : ""} and we wanted to reach out.\n\nWe have availability coming up and would love to get you booked in. As a returning customer you'll always get priority scheduling.\n\nReply to this message or call us to book — it's great to have you back.\n\nKind regards`,
    },
    reminder: {
      subject: `Time for your next clean, ${first}?`,
      body: `Hi ${first},\n\nJust a friendly reminder that it's been ${daysSince} days since your last ${lastService?.label ?? "clean"} with us.\n\nWould you like to book in? We have slots available and can usually fit around your schedule.\n\nLet me know what works for you.\n\nThanks`,
    },
    upsell_deep: {
      subject: `${first} — have you considered a deep clean?`,
      body: `Hi ${first},\n\nYou've been a loyal regular clean customer and I wanted to suggest something that many of our customers find really worthwhile — a quarterly deep clean.\n\nIt takes care of all the areas a regular clean doesn't quite reach: oven, inside cupboards, behind appliances, skirting boards and more. Most customers notice the difference immediately.\n\nI could fit it in during your next regular visit or book a separate session — whichever suits. From £${Math.round(lastService?.price ?? 80) + 40}.\n\nWorth considering?`,
    },
    upsell_carpet: {
      subject: `${first} — quick question about your carpets`,
      body: `Hi ${first},\n\nI noticed we haven't done the carpets yet — would you like me to include a carpet clean next time I'm in?\n\nI can do it at the same visit which saves you time, and it makes a real difference alongside a regular clean. From £40 per room.\n\nJust let me know and I'll bring the equipment along.`,
    },
    crosssell_exterior: {
      subject: `${first} — while we're there...`,
      body: `Hi ${first},\n\nI'm coming to you for the windows soon and wanted to mention — we also do driveway and patio pressure washing while we're visiting.\n\nIt's a great time of year to get the exterior looking sharp and saves you arranging a separate visit. From £80 for a standard driveway.\n\nShall I quote you while I'm there?`,
    },
    crosssell_regular: {
      subject: `${first} — regular cleaning from next month?`,
      body: `Hi ${first},\n\nGreat to help with your recent clean — I hope you're happy with how it turned out.\n\nI wanted to mention that many customers find it easier to set up a regular slot — fortnightly or monthly — so the house stays on top of itself. It also means you get priority scheduling and I can often fit you in at the same time each visit.\n\nWould that be of interest? Happy to discuss what would work for you.`,
    },
  };

  return templates[messageType] ?? templates.reminder;
}

export async function generateAIMessage(customer, suggestionType, customInstructions = "") {
  const daysSince = customer.lastJobDate
    ? Math.floor((Date.now() - new Date(customer.lastJobDate)) / 86400000)
    : null;
  const prompt = `You are writing a short, warm, professional message from a UK cleaning business owner to a customer.

Customer: ${customer.name}
Last job: ${customer.services[0]?.label ?? "general clean"} on ${new Date(customer.lastJobDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
Days since last job: ${daysSince}
Customer notes: ${customer.notes}
Services they've had: ${[...new Set(customer.services.map(s => s.label))].join(", ")}
Message purpose: ${suggestionType}
${customInstructions ? `Additional instructions: ${customInstructions}` : ""}

Write a concise, friendly, personal message (3-4 short paragraphs max). No subject line. Start with "Hi ${customer.name.split(" ")[0]}," — do not use formal language or corporate speak. Sound like a real person who knows this customer. End with "Kind regards" only — no name placeholder needed.`;

  const { data, error } = await supabase.functions.invoke("ai-generate", {
    body: { messages: [{ role: "user", content: prompt }], max_tokens: 400 },
  });
  if (error) throw error;
  return data?.content?.[0]?.text ?? "";
}
