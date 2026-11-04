/**
 * The one floating surface every overlay on the map uses: a single hairline
 * border and a soft two-step shadow, no nested frames. Solid on purpose:
 * `backdrop-blur` over a WebGL canvas forces a blur pass on every map frame.
 */
export const surface =
    'rounded-xl border border-black/[0.07] bg-background shadow-[0_1px_2px_rgba(0,0,0,0.05),0_10px_28px_-10px_rgba(0,0,0,0.22)]';
