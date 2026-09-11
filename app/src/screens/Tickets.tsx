"use client";
import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Palette, Smartphone, QrCode, Plus, ScanLine, Share2, Check, Globe2, Lock } from "lucide-react";
import { AdmitOneTicket, TICKET_PALETTES, PALETTE_NAMES, useTilt } from "@/components/ui/admit-one-ticket";
import { Glass, Sheet, Notice, Pill } from "@/components/ui/glass";
import { store, useStore, type Ticket } from "@/lib/store";
import * as api from "@/lib/api";

export default function Tickets() {
  const tickets = useStore(s => s.tickets);
  const me = useStore(s => s.me);
  const [open, setOpen] = React.useState<string | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [publicEvents, setPublicEvents] = React.useState<any[] | null>(null);
  const list = Object.values(tickets).sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));

  React.useEffect(() => {
    if (!api.canShare()) return;
    api.publicEvents().then(r => setPublicEvents(r.events || []));
  }, []);

  if (open && tickets[open]) return <TicketDetail t={tickets[open]} back={() => setOpen(null)} />;

  return (
    <div className="px-5 pb-4 pt-[calc(18px+var(--safe-t))]">
      <div className="mb-1 flex items-start justify-between">
        <h1 className="display">Tickets</h1>
        <button onClick={() => setCreating(true)}
          className="glass grid h-10 w-10 place-items-center rounded-full transition-transform active:scale-95">
          <Plus className="h-4 w-4" />
        </button>
      </div>
      <p className="mb-6 text-[14px] text-white/45">Events Planzo hosts issue their own ticket</p>

      {/* Social — public events other people have hosted. Not filtered by
          school/friends yet (needs a real follow-graph and the college
          field wired through, both tracked in ROADMAP.md); everyone public
          shows for now rather than pretending a narrower feed exists. */}
      {publicEvents && publicEvents.length > 0 && (
        <div className="mb-6">
          <h3 className="mb-3 text-[15px] font-semibold">Public events near you</h3>
          <div className="no-bar edge-fade -mx-5 flex gap-3 overflow-x-auto px-5 pb-1">
            {publicEvents.map((e, i) => (
              <a key={e.id} href={`/e/${e.id}`}
                className="block w-[200px] shrink-0 text-left">
                <Glass className="p-4 transition-transform active:scale-[.98]">
                  <p className="mb-1 truncate text-[10px] font-bold uppercase tracking-wider text-[#C9C1FF]">
                    {e.ownerName || "Hosted event"}
                  </p>
                  <p className="line-clamp-2 text-[14px] font-semibold leading-snug">{e.title}</p>
                  <p className="mt-1.5 truncate text-[11.5px] text-white/45">{e.venue}</p>
                  <p className="mt-1.5 text-[11px] text-white/35">{e.counts?.going ?? 0} going</p>
                </Glass>
              </a>
            ))}
          </div>
        </div>
      )}

      {list.length === 0 ? (
        <Glass className="p-8 text-center">
          <ScanLine className="mx-auto mb-3 h-7 w-7 text-white/25" />
          <p className="text-[15px] text-white/55">No tickets yet.</p>
          <p className="mt-1 text-[13.5px] text-white/35">Host an event and claim one to see it.</p>
          <button onClick={() => setCreating(true)}
            className="mt-4 rounded-full px-5 py-2.5 text-[14px] font-semibold"
            style={{ background: "var(--grad-brand)" }}>Host an event</button>
        </Glass>
      ) : (
        <div className="space-y-4">
          {list.map((t, i) => (
            <motion.button key={t.id}
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * .07, ease: [.22,1,.36,1] }}
              onClick={() => setOpen(t.id)} className="block w-full">
              <MiniTicket t={t} />
            </motion.button>
          ))}
        </div>
      )}

      <AnimatePresence>
        {creating && (
          <Sheet open onClose={() => setCreating(false)} title="Host an event">
            <CreateEvent me={me} onDone={(t, shareUrl) => {
              store.addTicket(shareUrl ? { ...t, shareUrl } : t);
              setCreating(false); setOpen(t.id);
              if (shareUrl) navigator.clipboard?.writeText(shareUrl).catch(() => {});
            }} />
          </Sheet>
        )}
      </AnimatePresence>
    </div>
  );
}

function MiniTicket({ t }: { t: Ticket }) {
  const [w, setW] = React.useState(320);
  const ref = React.useRef<HTMLDivElement>(null);
  React.useLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(el); return () => ro.disconnect();
  }, []);
  return (
    <div ref={ref} className="w-full">
      <AdmitOneTicket
        width={w} seed={t.id} admitted={t.admitted}
        palette={t.palette ? TICKET_PALETTES[t.palette] : undefined}
        name={t.attendee} presenter="Planzo presents" event={t.eventTitle}
        venue={t.venue} dates={t.dates} watermark="PZ" tilt={false}
      />
    </div>
  );
}

function TicketDetail({ t, back }: { t: Ticket; back: () => void }) {
  const [w, setW] = React.useState(340);
  const [palette, setPalette] = React.useState(t.palette || "");
  const [showPal, setShowPal] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const { enableGyro, gyroOn, gyroAvailable } = useTilt();

  const copyLink = async () => {
    if (!t.shareUrl) return;
    await navigator.clipboard.writeText(t.shareUrl);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  React.useLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(el); return () => ro.disconnect();
  }, []);

  const pick = (name: string) => {
    setPalette(name);
    store.addTicket({ ...t, palette: name });
  };

  return (
    <div className="px-5 pb-4 pt-[calc(18px+var(--safe-t))]">
      <button onClick={back} className="mb-5 flex items-center gap-1.5 text-[14px] text-white/45 hover:text-white">
        <ArrowLeft className="h-4 w-4" /> Tickets
      </button>

      <motion.div ref={ref} className="w-full"
        initial={{ opacity: 0, y: 24, rotateX: 8 }} animate={{ opacity: 1, y: 0, rotateX: 0 }}
        transition={{ type: "spring", stiffness: 220, damping: 26 }}>
        <AdmitOneTicket
          width={w} seed={t.id} admitted={t.admitted}
          palette={palette ? TICKET_PALETTES[palette] : undefined}
          name={t.attendee} presenter="Planzo presents" event={t.eventTitle}
          venue={t.venue} dates={t.dates} watermark="PZ"
        />
      </motion.div>

      <div className="mt-5 flex gap-2.5">
        {t.shareUrl && (
          <button onClick={copyLink}
            className="glass flex flex-1 items-center justify-center gap-2 rounded-full py-3.5 text-[14px] font-semibold transition-transform active:scale-[.98]">
            {copied ? <><Check className="h-4 w-4 text-emerald-300" /> Copied</> : <><Share2 className="h-4 w-4" /> Copy link</>}
          </button>
        )}
        <button onClick={() => setShowPal(true)}
          className="glass flex flex-1 items-center justify-center gap-2 rounded-full py-3.5 text-[14px] font-semibold transition-transform active:scale-[.98]">
          <Palette className="h-4 w-4" /> Colour
        </button>
        {gyroAvailable && !gyroOn && (
          <button onClick={enableGyro}
            className="glass flex flex-1 items-center justify-center gap-2 rounded-full py-3.5 text-[14px] font-semibold transition-transform active:scale-[.98]">
            <Smartphone className="h-4 w-4" /> Tilt with phone
          </button>
        )}
      </div>

      <p className="mt-3 text-center text-[12.5px] text-white/35">
        {gyroOn ? "Move your phone — the ticket follows."
                : gyroAvailable ? "Drag across the ticket, or turn on motion to tilt it with your phone."
                : "Move your cursor across the ticket."}
      </p>

      <Glass className="mt-5 p-5">
        <div className="mb-3 flex items-center justify-between">
          <h4 className="text-[16px]">Details</h4>
          <Pill className={t.admitted ? "!text-emerald-300" : "!text-[#C9C1FF]"}>
            {t.admitted ? "Checked in" : "Valid"}
          </Pill>
        </div>
        <Row k="Event">{t.eventTitle}</Row>
        <Row k="Attendee">{t.attendee}</Row>
        <Row k="Venue">{t.venue}</Row>
        <Row k="When">{t.dates}</Row>
        <Row k="Ticket">#{t.id.slice(0, 8).toUpperCase()}</Row>
      </Glass>

      <div className="mt-4">
        <Notice tone="info">
          The animation is the experience — the door checks this against the server.
          A screenshot won't get anyone in.
        </Notice>
      </div>

      {!t.admitted && (
        <button onClick={() => store.addTicket({ ...t, admitted: true })}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-[14.5px] font-semibold"
          style={{ background: "var(--grad-brand)" }}>
          <QrCode className="h-4 w-4" /> Simulate door scan
        </button>
      )}

      <AnimatePresence>
        {showPal && (
          <Sheet open onClose={() => setShowPal(false)} title="Ticket colour">
            <div className="grid grid-cols-3 gap-3">
              {PALETTE_NAMES.map(n => {
                const p = TICKET_PALETTES[n];
                return (
                  <button key={n} onClick={() => { pick(n); setShowPal(false); }}
                    className={`overflow-hidden rounded-2xl border-2 transition-transform active:scale-95 ${
                      palette === n ? "border-white/70" : "border-white/10"}`}>
                    <div className="h-16 w-full" style={{
                      background: `radial-gradient(60% 75% at 62% 30%, ${p.light}, ${p.mid} 45%, ${p.base})`,
                    }} />
                    <p className="py-2 text-center text-[12px] font-semibold capitalize text-white/70">{n}</p>
                  </button>
                );
              })}
            </div>
          </Sheet>
        )}
      </AnimatePresence>
    </div>
  );
}

const Row = ({ k, children }: { k: string; children: React.ReactNode }) => (
  <div className="flex items-baseline justify-between gap-4 py-1.5 text-[14px]">
    <span className="shrink-0 text-white/40">{k}</span>
    <span className="truncate text-right font-medium">{children}</span>
  </div>
);

function CreateEvent({ me, onDone }: { me: any; onDone: (t: Ticket, shareUrl?: string) => void }) {
  const [title, setTitle] = React.useState("");
  const [venue, setVenue] = React.useState("");
  const [visibility, setVisibility] = React.useState<"public" | "private">("private");
  const [when, setWhen] = React.useState(() => {
    const d = new Date(Date.now() + 7 * 864e5);
    return d.toISOString().slice(0, 10);
  });
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const create = async () => {
    if (!title.trim() || !venue.trim() || !me) return;
    setBusy(true); setErr(null);
    try {
      if (!api.canShare()) {
        // Single-file/no-server download build — nothing to host against,
        // fall back to a local-only ticket like before.
        onDone({
          id: crypto.randomUUID().slice(0, 12), eventId: crypto.randomUUID().slice(0, 8),
          eventTitle: title.trim(), venue: venue.trim(),
          dates: new Date(when + "T12:00:00").toLocaleDateString([], { month: "long", day: "numeric" }),
          attendee: me.name, issuedAt: new Date().toISOString(),
        });
        return;
      }
      const hosted = await api.hostEvent({
        name: me.name, title: title.trim(), venue: venue.trim(),
        startsAt: new Date(when + "T18:00:00").toISOString(), visibility,
      });
      if (!hosted) { setErr("Couldn't create the event — try again."); return; }
      const claimed = await api.claimTicket(hosted.event.id, me.name);
      if (!claimed.ok) { setErr(claimed.message || "Couldn't issue your ticket."); return; }
      onDone({
        id: claimed.ticket.id, eventId: hosted.event.id, eventTitle: title.trim(), venue: venue.trim(),
        dates: new Date(when + "T12:00:00").toLocaleDateString([], { month: "long", day: "numeric" }),
        attendee: me.name, issuedAt: claimed.ticket.issuedAt,
      }, hosted.shareUrl);
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-3">
      <Field label="Event name" value={title} onChange={setTitle} placeholder="Fall Social" />
      <Field label="Venue" value={venue} onChange={setVenue} placeholder="The Barn" />
      <Field label="Date" value={when} onChange={setWhen} type="date" />

      <div>
        <span className="mb-1.5 block text-[12.5px] font-medium text-white/50">Who can see this</span>
        <div className="flex gap-2">
          <button onClick={() => setVisibility("private")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-2xl border py-3 text-[13.5px] font-medium transition-colors ${
              visibility === "private" ? "border-[#7C6BFF]/60 bg-[#7C6BFF]/15 text-[#C9C1FF]" : "border-white/10 bg-white/[.04] text-white/55"}`}>
            <Lock className="h-3.5 w-3.5" /> Private link
          </button>
          <button onClick={() => setVisibility("public")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-2xl border py-3 text-[13.5px] font-medium transition-colors ${
              visibility === "public" ? "border-[#7C6BFF]/60 bg-[#7C6BFF]/15 text-[#C9C1FF]" : "border-white/10 bg-white/[.04] text-white/55"}`}>
            <Globe2 className="h-3.5 w-3.5" /> Public
          </button>
        </div>
        <p className="mt-1.5 text-[11.5px] text-white/35">
          {visibility === "private" ? "Only people with the link can find it." : "Shows up in Public events for everyone nearby."}
        </p>
      </div>

      {err && <Notice tone="warn">{err}</Notice>}
      <button onClick={create} disabled={busy || !title.trim() || !venue.trim()}
        className="mt-2 w-full rounded-full py-3.5 text-[15px] font-semibold disabled:opacity-40"
        style={{ background: "var(--grad-brand)" }}>
        {busy ? "Creating…" : "Create & issue my ticket"}
      </button>
      <p className="text-center text-[12px] text-white/35">
        Free ticket. Paid tickets need a payment provider, which isn't connected — Planzo won't issue one.
      </p>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", placeholder }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12.5px] font-medium text-white/50">{label}</span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="glass w-full rounded-2xl px-4 py-3.5 text-[15px] outline-none [color-scheme:dark] placeholder:text-white/30" />
    </label>
  );
}
