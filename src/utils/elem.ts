// TODO: connect this to HTML's definition
type EventListener = (e: PointerEvent) => void;

interface Attributes {
  [key: string]: string | Attributes | EventListener;
}

/**
 * Creates an HTMLElement with optional attributes and children
 *
 * Examples:
 *
 * ```js
 *   br = createElem('br');
 *   p = createElem('p', 'hello world');
 *   a = createElem('a', {href: 'https://google.com', textContent: 'Google'});
 *   ul = createElement('ul', {}, [
 *     createElem('li', 'apple'),
 *     createElem('li', 'banana'),
 *   ]);
 *   h1 = createElem('h1', { style: { color: 'red' }, textContent: 'Title'})
 * ```
 */
export function createElem(
  tag: string,
  attrs: Attributes | string = {},
  children: HTMLElement[] = []
) {
  const elem = document.createElement(tag) as HTMLElement;
  if (typeof attrs === 'string') {
    elem.textContent = attrs;
  } else {
    const elemAsAttribs = elem as unknown as Attributes;
    for (const [key, value] of Object.entries(attrs)) {
      if (typeof value === 'function' && key.startsWith('on')) {
        const eventName = key.substring(2).toLowerCase();
        // TODO: make type safe or at least more type safe.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        elem.addEventListener(eventName as any, value as EventListener, {
          passive: false,
        });
      } else if (typeof value === 'object') {
        for (const [k, v] of Object.entries(value)) {
          (elemAsAttribs[key] as Attributes)[k] = v;
        }
      } else if (elemAsAttribs[key] === undefined) {
        elem.setAttribute(key, value as string);
      } else {
        elemAsAttribs[key] = value;
      }
    }
  }
  for (const child of children) {
    elem.appendChild(child);
  }
  return elem;
}

export type ElemSpec =
  | string
  | [string, Attributes, ...ElemSpec[]]
  | [string, ...ElemSpec[]];
//type ElemSpec = JsonMLNode;

/**
 * Implements JsonML *like* element creation (http://www.jsonml.org/)
 *
 * The major difference is this takes event handlers for `on` functions and supports nested attributes?
 */
export function makeElem(elemSpec: ElemSpec) {
  return makeElemImpl(elemSpec) as HTMLElement;
}

function makeElemImpl(elemSpec: ElemSpec) {
  if (typeof elemSpec === 'string') {
    return document.createTextNode(elemSpec);
  }

  const tag = elemSpec[0];
  const elem = document.createElement(tag) as HTMLElement;

  let firstChildNdx = 1;
  if (typeof elemSpec[1] !== 'string' && !Array.isArray(elemSpec[1])) {
    firstChildNdx = 2;
    const attribs = elemSpec[1] as Attributes;
    const elemAsAttribs = elem as unknown as Attributes;
    for (const [key, value] of Object.entries(attribs)) {
      if (typeof value === 'function' && key.startsWith('on')) {
        const eventName = key.substring(2).toLowerCase();
        // TODO: make type safe or at least more type safe.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        elem.addEventListener(eventName as any, value as EventListener, {
          passive: false,
        });
      } else if (typeof value === 'object') {
        for (const [k, v] of Object.entries(value)) {
          (elemAsAttribs[key] as Attributes)[k] = v;
        }
      } else if (elemAsAttribs[key] === undefined) {
        elem.setAttribute(key, value as string);
      } else {
        elemAsAttribs[key] = value;
      }
    }
  }

  for (let ndx = firstChildNdx; ndx < elemSpec.length; ++ndx) {
    elem.appendChild(makeElemImpl(elemSpec[ndx] as ElemSpec));
  }
  return elem;
}
