type TrashOutlineIconProps = {
  className?: string;
};

/** Inline SVG so iOS Safari does not show image long-press menu on delete buttons. */
export function TrashOutlineIcon({ className }: TrashOutlineIconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 320 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M95 43H225" stroke="#4B5563" strokeWidth="10" strokeLinecap="round" />
      <path
        d="M122 43V30C122 19.5066 130.507 11 141 11H179C189.493 11 198 19.5066 198 30V43"
        stroke="#4B5563"
        strokeWidth="10"
        strokeLinecap="round"
      />
      <path
        d="M107 43L118 176C118.965 187.661 128.707 196.6 140.408 196.6H179.592C191.293 196.6 201.035 187.661 202 176L213 43"
        stroke="#4B5563"
        strokeWidth="10"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M141 73V163" stroke="#4B5563" strokeWidth="10" strokeLinecap="round" />
      <path d="M160 73V163" stroke="#4B5563" strokeWidth="10" strokeLinecap="round" />
      <path d="M179 73V163" stroke="#4B5563" strokeWidth="10" strokeLinecap="round" />
    </svg>
  );
}
