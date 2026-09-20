/**
 * A very small rendering layer.
 *
 * `h` is a tagged template that escapes every interpolated value by default.
 * Markup that is already trusted (built by another `h` call) is passed
 * through `raw`. Nothing reaches innerHTML without going through one or the
 * other, so provider-supplied names cannot become markup.
 */

const RAW = Symbol('raw-html');

export interface RawHtml {
  [RAW]: true;
  value: string;
}

export function raw(value: string): RawHtml {
  return { [RAW]: true, value };
}

function isRaw(value: unknown): value is RawHtml {
  return typeof value === 'object' && value !== null && RAW in value;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

type Interpolated = string | number | boolean | null | undefined | RawHtml | Array<string | RawHtml>;

/** Build HTML. Strings are escaped; use `raw()` for trusted fragments. */
export function h(strings: TemplateStringsArray, ...values: Interpolated[]): RawHtml {
  let out = '';
  for (const [index, chunk] of strings.entries()) {
    out += chunk;
    if (index < values.length) out += stringify(values[index]);
  }
  return raw(out);
}

function stringify(value: Interpolated): string {
  if (value === null || value === undefined || value === false) return '';
  if (value === true) return '';
  if (isRaw(value)) return value.value;
  if (Array.isArray(value)) return value.map((item) => (isRaw(item) ? item.value : escapeHtml(item))).join('');
  return escapeHtml(String(value));
}

export function render(target: Element, content: RawHtml): void {
  target.innerHTML = content.value;
}

/** `classes('btn', isActive && 'btn--active')` */
export function classes(...values: Array<string | false | null | undefined>): string {
  return values.filter((value): value is string => typeof value === 'string' && value !== '').join(' ');
}

/**
 * Delegated click handling.
 *
 * One listener per root rather than one per button, so a re-render never
 * leaks listeners and never needs them reattached.
 */
export function onClick(
  root: Element,
  selector: string,
  handler: (element: HTMLElement, event: MouseEvent) => void,
): void {
  root.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const match = target.closest(selector);
    if (match instanceof HTMLElement && root.contains(match)) handler(match, event as MouseEvent);
  });
}

export function qs<T extends Element = HTMLElement>(selector: string, root: ParentNode = document): T | null {
  return root.querySelector<T>(selector);
}
