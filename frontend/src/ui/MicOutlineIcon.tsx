type MicOutlineIconProps = {
  className?: string;
};

/** Inline SVG so iOS Safari does not show image long-press menu on the mic button. */
export function MicOutlineIcon({ className }: MicOutlineIconProps) {
  return (
    <svg
      className={className}
      viewBox="200 0 520 520"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="460" cy="256" r="252" stroke="#C7A56E" strokeWidth="16" />
      <rect x="430" y="161" width="60" height="120" rx="30" stroke="#000000" strokeWidth="16" />
      <path
        d="M397 246C397 281.899 426.101 311 462 311C497.899 311 527 281.899 527 246"
        stroke="#000000"
        strokeWidth="16"
        strokeLinecap="round"
      />
      <path d="M462 311V374" stroke="#000000" strokeWidth="16" strokeLinecap="round" />
      <path d="M425 374H499" stroke="#000000" strokeWidth="16" strokeLinecap="round" />
    </svg>
  );
}
