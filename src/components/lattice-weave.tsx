export function LatticeWeave() {
  return (
    <svg
      className="lattice-weave"
      viewBox="0 0 360 210"
      fill="none"
      aria-hidden="true"
    >
      <g className="weave-guides" stroke="currentColor" strokeWidth="0.7">
        <path d="M0 105H360M180 0V210" strokeDasharray="2 7" />
        <ellipse cx="180" cy="105" rx="146" ry="78" />
      </g>
      <g className="weave-leaves" stroke="currentColor" strokeWidth="1.5">
        <path
          pathLength="1"
          d="M180 190C75 160 46 57 180 20C314 57 285 160 180 190Z"
        />
        <path
          pathLength="1"
          d="M180 190C58 193 3 104 76 53C176 53 241 119 180 190Z"
        />
        <path
          pathLength="1"
          d="M180 190C302 193 357 104 284 53C184 53 119 119 180 190Z"
        />
        <path
          pathLength="1"
          d="M180 190V20M76 53L180 190L284 53"
          strokeWidth="0.8"
        />
      </g>
      <g className="weave-nodes" fill="currentColor">
        <circle cx="180" cy="20" r="3" />
        <circle cx="76" cy="53" r="3" />
        <circle cx="284" cy="53" r="3" />
        <circle cx="180" cy="190" r="3" />
        <circle cx="180" cy="105" r="5" />
      </g>
    </svg>
  );
}
