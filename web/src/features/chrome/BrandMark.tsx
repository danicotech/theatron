/** Approved cinnabar raven mark; the sword is transparent negative space. */
export function BrandMark({ className = '' }: { className?: string }) {
  return (
    <svg
      className={`brand-mark ${className}`}
      viewBox="200 70 800 800"
      width="36"
      height="36"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      data-brand-mark
    >
      <g data-brand-wing>
        <path d="M578 116 C536 257 454 421 294 548 L250 541 L312 614 C382 567 434 518 480 481 C519 449 534 531 546 615 L576 844 L565 383 L525 367 L576 330 Z" />
      </g>
      <g data-brand-wing>
        <path
          d="M578 116 C536 257 454 421 294 548 L250 541 L312 614 C382 567 434 518 480 481 C519 449 534 531 546 615 L576 844 L565 383 L525 367 L576 330 Z"
          transform="translate(1200 0) scale(-1 1)"
        />
      </g>
    </svg>
  );
}
export function BrandIdentity() {
  return (
    <>
      <BrandMark />
      <span className="brand-wordmark">
        <span>夜鴉閣</span>
      </span>
    </>
  );
}
