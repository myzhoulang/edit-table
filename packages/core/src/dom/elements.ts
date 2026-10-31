export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = '',
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
export function button(label: string, icon: string, action: () => void): HTMLButtonElement {
  const node = el('button', 'et-icon-button');
  node.type = 'button';
  node.title = label;
  node.setAttribute('aria-label', label);
  node.textContent = icon;
  node.addEventListener('click', action);
  return node;
}
export function textValue(value: unknown): string {
  return value == null
    ? ''
    : Array.isArray(value)
      ? value.map(textValue).join(' / ')
      : String(value);
}
