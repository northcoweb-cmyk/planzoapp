"use client";
import * as React from "react";
import { motion } from "framer-motion";
import { MapPin, ExternalLink, Sparkles } from "lucide-react";
import { Glass, Pill, Img, Sheet } from "./glass";
import * as places from "@/lib/engine/places.js";

export const PRICE_LEVELS = ["PRICE_LEVEL_FREE","PRICE_LEVEL_INEXPENSIVE","PRICE_LEVEL_MODERATE","PRICE_LEVEL_EXPENSIVE","PRICE_LEVEL_VERY_EXPENSIVE"];
export const priceTag = (level?: string) => level ? "$".repeat(Math.max(1, PRICE_LEVELS.indexOf(level))) : null;

/** Restaurant/activity card — same 2-column, image-on-top shape as an event
 * card, so a feed reads as one visual system instead of events looking
 * like a different app than everything below them. Shared between
 * Discover and Home so both render restaurants/activities identically. */
export function VenueGridCard({ v, i, onClick }: { v: any; i: number; onClick?: () => void }) {
  const [photo, setPhoto] = React.useState<string | null>(null);
  React.useEffect(() => { places.photoFor(v, 400).then(setPhoto); }, [v]);
  return (
    <motion.button
      onClick={onClick} className="text-left"
      initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(i, 8) * .04, duration: .45, ease: [.22,1,.36,1] }}
    >
      <Glass className="h-full overflow-hidden p-0 transition-transform active:scale-[.98]">
        <Img src={photo} alt={v.name} ratio="4/3" />
        <div className="p-3">
          <div className="mb-1 flex items-center justify-between gap-2">
            <p className="truncate text-[10px] font-bold uppercase tracking-wider text-[#C9C1FF]">
              {v.rating ? `★ ${v.rating}` : "Restaurant"}
            </p>
            {priceTag(v.priceLevel) && <p className="shrink-0 text-[11px] font-bold text-white/55">{priceTag(v.priceLevel)}</p>}
          </div>
          <p className="line-clamp-2 text-[13.5px] font-semibold leading-snug">{v.name}</p>
          <p className="mt-1.5 truncate text-[11.5px] text-white/45">{v.address}</p>
          {v.openNow === true && <p className="mt-1 text-[11px] font-semibold text-emerald-300">Open now</p>}
        </div>
      </Glass>
    </motion.button>
  );
}

export function VenueSheet({ v, onClose, onStartIdea, label = "Restaurant" }: { v: any; onClose: () => void; onStartIdea: () => void; label?: string }) {
  const [photo, setPhoto] = React.useState<string | null>(null);
  React.useEffect(() => { places.photoFor(v, 800).then(setPhoto); }, [v]);
  return (
    <Sheet open onClose={onClose}>
      <div className="-mx-5 -mt-5 mb-4">
        <Img src={photo} alt={v.name} ratio="16/9" className="rounded-t-[34px]" />
      </div>
      <p className="mb-1.5 text-[10.5px] font-bold uppercase tracking-wider text-[#C9C1FF]">{label}</p>
      <h2 className="text-[24px] leading-tight">{v.name}</h2>

      <div className="mt-4 space-y-2.5 text-[14px]">
        <div className="flex items-start gap-2.5 text-white/70">
          <span className="mt-0.5 shrink-0 text-white/35"><MapPin className="h-4 w-4" /></span><span>{v.address}</span>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {v.rating && <Pill>★ {v.rating}{v.ratingCount ? ` (${v.ratingCount})` : ""}</Pill>}
        {priceTag(v.priceLevel) && <Pill>{priceTag(v.priceLevel)}</Pill>}
        {v.openNow === true && <Pill className="!text-emerald-300">Open now</Pill>}
      </div>

      <div className="mt-5 flex gap-2.5">
        <button onClick={onStartIdea}
          className="flex flex-1 items-center justify-center gap-2 rounded-full py-3.5 text-[15px] font-semibold text-white transition-transform active:scale-[.98]"
          style={{ background: "var(--grad-brand)" }}>
          <Sparkles className="h-4 w-4" /> Start an idea with this
        </button>
        {v.website && (
          <a href={v.website} target="_blank" rel="noopener"
            className="glass grid place-items-center rounded-full px-4 transition-transform active:scale-[.98]">
            <ExternalLink className="h-4 w-4" />
          </a>
        )}
      </div>
    </Sheet>
  );
}
