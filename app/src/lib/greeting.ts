/** The home screen reads the clock and speaks to the moment. */
export type Slot = 'dawn' | 'morning' | 'afternoon' | 'evening' | 'night' | 'latenight';

export function timeSlot(d = new Date()): Slot {
  const h = d.getHours();
  if (h < 5) return 'latenight';
  if (h < 8) return 'dawn';
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  if (h < 21) return 'evening';
  return 'night';
}

const COPY: Record<Slot, { hi: string; line: string; prompts: string[] }> = {
  dawn:      { hi: 'Early one', line: 'Anything on for today?',
               prompts: ['Breakfast somewhere good', 'Something outdoors today', 'Plan my Saturday'] },
  morning:   { hi: 'Morning', line: 'What are we doing today?',
               prompts: ['Brunch with friends', 'Something free today', 'Coffee then a walk'] },
  afternoon: { hi: 'Afternoon', line: 'What are we doing later?',
               prompts: ['Dinner tonight', 'Something after work', 'Cheap night out'] },
  evening:   { hi: 'Evening', line: "What's the move tonight?",
               prompts: ['Dinner tonight', 'Drinks nearby', 'Something happening now'] },
  night:     { hi: 'Evening', line: "What's the move?",
               prompts: ['Late food', 'Bars near me', 'Plan tomorrow'] },
  latenight: { hi: 'Still up', line: 'Planning something?',
               prompts: ['Late night food', 'Plan this weekend', 'Something tomorrow'] },
};

/** The aurora shifts with the hour, so the app feels different at 9am and 11pm. */
const TINT: Record<Slot, [string, string, string, string]> = {
  dawn:      ['#F59E0B', '#F43F5E', '#6366F1', '#FB923C'],
  morning:   ['#0EA5E9', '#6366F1', '#22D3EE', '#A78BFA'],
  afternoon: ['#6366F1', '#0EA5E9', '#8B5CF6', '#F59E0B'],
  evening:   ['#8B5CF6', '#C026D3', '#F43F5E', '#6366F1'],
  night:     ['#4338CA', '#7C3AED', '#0EA5E9', '#C026D3'],
  latenight: ['#312E81', '#1E1B4B', '#4C1D95', '#0369A1'],
};

export const greetingFor = (slot: Slot) => COPY[slot];
export const auroraFor = (slot: Slot) => TINT[slot];
