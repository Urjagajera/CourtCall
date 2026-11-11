// Animated illustration of an Indian courtroom: ceiling fan, judge's bench, emblem with scales,
// the item display board, a ticking wall clock, and a junior reporting from the floor.
// Colors come from design tokens (fill-* classes), so it follows light/dark mode.

const ROBE = '#2B2B2B'
const SKIN = '#C98D6B'
const SKIN_2 = '#A9714F'

export function CourtroomScene({ item, status }: { item: number; status: 'hearing' | 'break' }) {
  return (
    <svg viewBox="0 0 600 440" role="img" aria-label={`Animated courtroom. Display board shows Court 4, item ${item}.`} className="h-auto w-full">
      {/* Wall + ceiling */}
      <rect x="0" y="0" width="600" height="300" className="fill-surface" />
      <rect x="0" y="0" width="600" height="22" className="fill-base-strong" />
      {/* Wood panelling */}
      <rect x="0" y="168" width="600" height="132" className="fill-surface-raised" />
      <rect x="0" y="164" width="600" height="6" className="fill-line" />
      {Array.from({ length: 15 }, (_, i) => (
        <line key={i} x1={20 + i * 40} y1="176" x2={20 + i * 40} y2="296" className="stroke-line" strokeWidth="2" />
      ))}

      {/* Pillars */}
      {[18, 548].map((x) => (
        <g key={x}>
          <rect x={x} y="22" width="34" height="278" className="fill-surface-raised stroke-line" strokeWidth="2" />
          <rect x={x - 6} y="22" width="46" height="14" className="fill-line" />
          <rect x={x - 6} y="286" width="46" height="14" className="fill-line" />
          {[0, 1, 2].map((k) => (
            <line key={k} x1={x + 9 + k * 8} y1="40" x2={x + 9 + k * 8} y2="282" className="stroke-line" strokeWidth="2" />
          ))}
        </g>
      ))}

      {/* Ceiling fan */}
      <line x1="300" y1="22" x2="300" y2="40" className="stroke-ink-muted" strokeWidth="3" />
      {/* Flattened vertically so the spinning blades read as a ceiling fan seen from the front. */}
      <g transform="translate(300 44) scale(1 0.2) translate(-300 -44)">
        <g className="cc-spin" style={{ transformOrigin: '300px 44px', transformBox: 'view-box' }}>
          {[0, 120, 240].map((r) => (
            <ellipse key={r} cx="300" cy="44" rx="34" ry="9" transform={`rotate(${r} 300 44) translate(36 0)`} className="fill-ink-muted" opacity="0.9" />
          ))}
        </g>
      </g>
      <ellipse cx="300" cy="44" rx="10" ry="6" className="fill-ink-muted" />

      {/* Item display board (like the boards outside Indian courtrooms) */}
      <g>
        <rect x="76" y="58" width="128" height="86" rx="8" fill="#1B1B22" />
        <rect x="82" y="64" width="116" height="74" rx="5" fill="#26262F" />
        <text x="92" y="82" fontSize="11" fontWeight="700" fill="#F5B69E" letterSpacing="1.5">
          COURT NO. 4
        </text>
        <circle cx="186" cy="78" r="4" fill={status === 'hearing' ? '#8FDCA9' : '#F3C673'} className="cc-blink" />
        <text x="92" y="100" fontSize="9" fill="#A9ABC4" letterSpacing="1">
          {status === 'hearing' ? 'NOW HEARING' : 'ON BREAK'}
        </text>
        <text x="92" y="128" fontSize="10" fontWeight="700" fill="#A9ABC4" letterSpacing="1">
          ITEM
        </text>
        <text
          key={item}
          x="190"
          y="131"
          textAnchor="end"
          fontSize="30"
          fontWeight="800"
          fill="#F5B69E"
          className="cc-flip tabular"
          style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
        >
          {item}
        </text>
      </g>

      {/* Wall clock */}
      <g>
        <circle cx="474" cy="98" r="30" className="fill-surface-raised stroke-ink" strokeWidth="3" />
        {Array.from({ length: 12 }, (_, i) => (
          <line key={i} x1="474" y1="72" x2="474" y2="76" transform={`rotate(${i * 30} 474 98)`} className="stroke-ink" strokeWidth="2" />
        ))}
        <line x1="474" y1="98" x2="474" y2="82" className="stroke-ink" strokeWidth="3" strokeLinecap="round" transform="rotate(-60 474 98)" />
        <g style={{ transformOrigin: '474px 98px', transformBox: 'view-box', animation: 'cc-spin 12s linear infinite' }}>
          <line x1="474" y1="98" x2="474" y2="76" className="stroke-ink" strokeWidth="2" strokeLinecap="round" />
        </g>
        <circle cx="474" cy="98" r="3" className="fill-ink" />
      </g>

      {/* Emblem with scales of justice */}
      <circle cx="300" cy="96" r="32" className="fill-surface-raised stroke-accent" strokeWidth="4" />
      <line x1="300" y1="76" x2="300" y2="116" className="stroke-ink" strokeWidth="3" strokeLinecap="round" />
      <line x1="288" y1="116" x2="312" y2="116" className="stroke-ink" strokeWidth="3" strokeLinecap="round" />
      <g className="cc-sway" style={{ transformOrigin: '300px 82px', transformBox: 'view-box' }}>
        <line x1="280" y1="82" x2="320" y2="82" className="stroke-ink" strokeWidth="3" strokeLinecap="round" />
        <path d="M280 82 L273 98 M280 82 L287 98" className="stroke-ink" strokeWidth="1.5" />
        <path d="M271 98 Q280 106 289 98 Z" className="fill-accent stroke-ink" strokeWidth="1.5" />
        <path d="M320 82 L313 98 M320 82 L327 98" className="stroke-ink" strokeWidth="1.5" />
        <path d="M311 98 Q320 106 329 98 Z" className="fill-accent stroke-ink" strokeWidth="1.5" />
      </g>

      {/* Judge's chair + judge */}
      <rect x="266" y="138" width="68" height="84" rx="14" className="fill-base-strong" />
      <circle cx="300" cy="166" r="13" fill={SKIN} />
      <path d="M287 160 Q300 148 313 160" stroke={ROBE} strokeWidth="5" fill="none" strokeLinecap="round" />
      <path d="M278 210 Q280 184 300 182 Q320 184 322 210 Z" fill={ROBE} />
      <rect x="296" y="183" width="3.5" height="10" fill="#FFFFFF" />
      <rect x="300.5" y="183" width="3.5" height="10" fill="#FFFFFF" />

      {/* Bench */}
      <rect x="140" y="204" width="320" height="10" rx="3" className="fill-surface-raised stroke-line" strokeWidth="2" />
      <rect x="150" y="214" width="300" height="66" className="fill-base-strong" />
      {[190, 250, 350, 410].map((x) => (
        <rect key={x} x={x - 22} y="224" width="44" height="46" rx="3" className="stroke-surface" strokeWidth="2" fill="none" opacity="0.5" />
      ))}
      <rect x="268" y="232" width="64" height="22" rx="4" className="fill-accent" />
      <text x="300" y="247" textAnchor="middle" fontSize="10" fontWeight="700" className="fill-accent-ink">
        COURT 4
      </text>

      {/* Gavel tapping on its block */}
      <rect x="392" y="198" width="30" height="7" rx="2" className="fill-ink-muted" />
      <g className="cc-gavel" style={{ transformOrigin: '440px 196px', transformBox: 'view-box' }}>
        <rect x="400" y="192" width="40" height="5" rx="2" fill="#8A5A3B" />
        <rect x="396" y="182" width="14" height="22" rx="3" fill="#6E4329" />
      </g>

      {/* Bar railing */}
      <rect x="0" y="300" width="600" height="140" className="fill-base" />
      <rect x="0" y="300" width="600" height="8" className="fill-line" />
      {Array.from({ length: 30 }, (_, i) => (
        <rect key={i} x={6 + i * 20} y="308" width="6" height="18" className="fill-line" />
      ))}
      <rect x="0" y="326" width="600" height="5" className="fill-line" />

      {/* Left table: senior lawyer addressing the court */}
      <g>
        <circle cx="120" cy="352" r="12" fill={SKIN_2} />
        <path d="M108 346 Q120 336 132 346" stroke={ROBE} strokeWidth="4" fill="none" />
        <path d="M100 398 Q102 370 120 366 Q138 370 140 398 Z" fill={ROBE} />
        <rect x="116.5" y="367" width="3" height="9" fill="#FFFFFF" />
        <rect x="120.5" y="367" width="3" height="9" fill="#FFFFFF" />
        <rect x="40" y="392" width="200" height="12" rx="3" className="fill-surface stroke-line" strokeWidth="2" />
        <rect x="52" y="404" width="8" height="30" className="fill-line" />
        <rect x="220" y="404" width="8" height="30" className="fill-line" />
        <rect x="150" y="384" width="34" height="8" rx="1" className="fill-surface-raised stroke-line" />
      </g>

      {/* Right table: junior reporting on the phone */}
      <g>
        <circle cx="470" cy="360" r="12" fill={SKIN} />
        <path d="M458 356 Q470 342 482 356" stroke={ROBE} strokeWidth="5" fill="none" />
        <path d="M450 404 Q452 378 470 374 Q488 378 490 404 Z" fill={ROBE} />
        <rect x="466.5" y="375" width="3" height="9" fill="#FFFFFF" />
        <rect x="470.5" y="375" width="3" height="9" fill="#FFFFFF" />
        <rect x="360" y="400" width="200" height="12" rx="3" className="fill-surface stroke-line" strokeWidth="2" />
        <rect x="372" y="412" width="8" height="24" className="fill-line" />
        <rect x="540" y="412" width="8" height="24" className="fill-line" />
        {/* phone + signal rings */}
        <rect x="490" y="376" width="12" height="20" rx="2.5" fill="#26262F" />
        <rect x="492" y="379" width="8" height="12" rx="1" className="fill-accent" />
        {[0, 0.7, 1.4].map((d) => (
          <circle
            key={d}
            cx="496"
            cy="384"
            r="10"
            fill="none"
            className="cc-ring stroke-accent"
            strokeWidth="2"
            style={{ transformOrigin: '496px 384px', transformBox: 'view-box', animationDelay: `${d}s` }}
          />
        ))}
        <path d="M500 372 C 530 330, 560 300, 580 250" fill="none" className="cc-dash stroke-accent" strokeWidth="2.5" />
      </g>
    </svg>
  )
}
