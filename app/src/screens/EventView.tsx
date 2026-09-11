"use client";
import * as React from "react";
import { Users, MapPin, Calendar, Ticket as TicketIcon, Check } from "lucide-react";
import { Glass, Pill, Notice } from "@/components/ui/glass";
import * as api from "@/lib/api";

const NAME_KEY = "planzo.participant-name.v1";

/** The page someone lands on from a hosted-event share link (/e/<id>) —
 * mirrors ParticipantView's shape (own identity, no local store, hits the
 * live server) but for RSVP + free ticket claiming instead of the
 * question flow. */
export default function EventView({ id }: { id: string }) {
  const [name, setName] = React.useState(() => { try { return localStorage.getItem(NAME_KEY) || ""; } catch { return ""; } });
  const [event, setEvent] = React.useState<any>(null);
  const [notFound, setNotFound] = React.useState(false);
  const [ticket, setTicket] = React.useState<any>(null);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    (async () => {
      const r = await api.getEvent(id);
      if (!r.event) { setNotFound(true); return; }
      setEvent(r.event);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const claim = async () => {
    if (!name.trim()) return;
    setBusy(true); setErr(null);
    try {
      try { localStorage.setItem(NAME_KEY, name.trim()); } catch {}
      await api.rsvpEvent(id, 'going', name.trim());
      const r = await api.claimTicket(id, name.trim());
      if (!r.ok) { setErr(r.message || "Couldn't claim a ticket for this one."); return; }
      setTicket(r.ticket);
    } finally { setBusy(false); }
  };

  if (notFound) {
    return (
      <Shell>
        <Glass className="p-8 text-center">
          <p className="text-[16px] font-semibold">This event isn't there anymore.</p>
          <p className="mt-1.5 text-[13.5px] text-white/40">It may have been removed, or the link was mistyped.</p>
        </Glass>
      </Shell>
    );
  }
  if (!event) return <Shell><div className="skeleton h-[220px] rounded-[28px]" /></Shell>;

  const when = event.startsAt ? new Date(event.startsAt).toLocaleString([], { weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : null;

  return (
    <Shell>
      <div className="relative mb-6 overflow-hidden rounded-[28px] p-6" style={{ background: "var(--grad-brand)" }}>
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-10 -left-6 h-28 w-28 rounded-full bg-black/10 blur-2xl" />
        <p className="relative mb-1.5 text-[11px] font-bold uppercase tracking-wider text-white/70">
          {event.visibility === 'public' ? "Public event" : "You're invited"}
        </p>
        <h1 className="relative text-[26px] font-bold leading-tight text-white">{event.title}</h1>
        {event.description && <p className="relative mt-1.5 text-[14px] text-white/85">{event.description}</p>}
        <div className="relative mt-4 flex flex-wrap gap-2">
          <Pill className="!bg-white/15 !text-white"><Users className="mr-1 inline h-3 w-3" /> {event.counts?.going ?? 0} going</Pill>
          {when && <Pill className="!bg-white/15 !text-white"><Calendar className="mr-1 inline h-3 w-3" /> {when}</Pill>}
          {event.venue && <Pill className="!bg-white/15 !text-white"><MapPin className="mr-1 inline h-3 w-3" /> {event.venue}</Pill>}
        </div>
      </div>

      {ticket ? (
        <Glass className="p-6 text-center">
          <Check className="mx-auto mb-2 h-8 w-8 text-emerald-300" />
          <p className="text-[16px] font-semibold">You're going — ticket claimed.</p>
          <p className="mt-1 text-[13.5px] text-white/45">Open Planzo's Tickets tab on this device to see it, or come back to this link any time.</p>
        </Glass>
      ) : (
        <Glass className="p-5">
          <p className="mb-3 text-[15px] font-semibold">RSVP and claim a free ticket</p>
          <input autoFocus value={name} onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && name.trim() && claim()}
            placeholder="Your name"
            className="glass mb-3 w-full rounded-2xl px-4 py-3.5 text-[15px] outline-none placeholder:text-white/25" />
          {err && <div className="mb-3"><Notice tone="warn">{err}</Notice></div>}
          <button disabled={!name.trim() || busy} onClick={claim}
            className="flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-[15px] font-semibold text-white transition-transform active:scale-[.98] disabled:opacity-40"
            style={{ background: "var(--grad-brand)" }}>
            <TicketIcon className="h-4 w-4" /> {busy ? "Claiming…" : "I'm going"}
          </button>
        </Glass>
      )}

      <p className="mt-6 text-center text-[12px] text-white/25">Hosted on Planzo — no account needed.</p>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-dvh">
      <div className="aurora">
        {["#7C6BFF", "#C026D3", "#6366F1"].map((c, i) => <i key={i} style={{ background: c }} />)}
      </div>
      <div className="grain" />
      <div className="relative z-10 mx-auto min-h-dvh w-full max-w-[480px] px-5 pb-10 pt-[calc(28px+var(--safe-t))]">
        {children}
      </div>
    </div>
  );
}
