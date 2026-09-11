"use client";
import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Palette, Smartphone, QrCode, Plus, ScanLine } from "lucide-react";
import { AdmitOneTicket, TICKET_PALETTES, PALETTE_NAMES, useTilt } from "@/components/ui/admit-one-ticket";
import { Glass, Sheet, Notice, Pill } from "@/components/ui/glass";
import { store, useStore, type Ticket } from "@/lib/store";

export default function Tickets() {
  const tickets = useStore(s => s.tickets);
  const me = useStore(s => s.me);
  const [open, setOpen] = React.useState<string | null>(null);
  const [creating, setCreating] = React.useState(false);
  const list = Object.values(tickets).sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));

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
            <CreateEvent me={me} onDone={(t) => { store.addTicket(t); setCreating(false); setOpen(t.id); }} />
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
  const ref = React.useRef<HTMLDivElement>(null);
  const { enableGyro, gyroOn, gyroAvailable } = useTilt();

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

function CreateEvent({ me, onDone }: { me: any; onDone: (t: Ticket) => void }) {
  const [title, setTitle] = React.useState("UMD Fall Social");
  const [venue, setVenue] = React.useState("The Barn");
  const [when, setWhen] = React.useState(() => {
    const d = new Date(Date.now() + 7 * 864e5);
    return d.toISOString().slice(0, 10);
  });
  const create = () => {
    onDone({
      id: crypto.randomUUID().slice(0, 12),
      eventId: crypto.randomUUID().slice(0, 8),
      eventTitle: title.trim() || "Planzo Event",
      venue: venue.trim() || "TBA",
      dates: new Date(when + "T12:00:00").toLocaleDateString([], { month: "long", day: "numeric" }),
      attendee: me?.name || "Guest",
      issuedAt: new Date().toISOString(),
    });
  };
  return (
    <div className="space-y-3">
      <Field label="Event name" value={title} onChange={setTitle} />
      <Field label="Venue" value={venue} onChange={setVenue} />
      <Field label="Date" value={when} onChange={setWhen} type="date" />
      <button onClick={create} className="mt-2 w-full rounded-full py-3.5 text-[15px] font-semibold"
        style={{ background: "var(--grad-brand)" }}>Create & issue my ticket</button>
      <p className="text-center text-[12px] text-white/35">
        Free ticket. Paid tickets need a payment provider, which isn't connected — Planzo won't issue one.
      </p>
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12.5px] font-medium text-white/50">{label}</span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)}
        className="glass w-full rounded-2xl px-4 py-3.5 text-[15px] outline-none [color-scheme:dark] placeholder:text-white/30" />
    </label>
  );
}
