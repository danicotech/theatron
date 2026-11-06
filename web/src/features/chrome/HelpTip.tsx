/** Supplementary guidance only; errors, current state and confirmations stay visible. */
export function HelpTip({ label, text }: { label: string; text: string }) {
  return (
    <button type="button" data-help={text} data-ink-wave="off" aria-label={`${label}說明`}>
      <span aria-hidden="true">!</span>
    </button>
  );
}
