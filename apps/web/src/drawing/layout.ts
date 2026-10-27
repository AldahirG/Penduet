/**
 * Width of the square canvas. From lg up it also stops short of the viewport height, so the whole square
 * fits on a laptop screen without scrolling (the page's other content sits beside it, not above it).
 * On phones and tablets it takes the full width.
 */
export const CANVAS_BOX = 'w-full max-w-canvas lg:max-w-[min(var(--layout-canvas-max),calc(100dvh_-_10rem))]'

/** The same for a room, whose title row (name, two player chips, four buttons) is taller than the other pages'. */
export const CANVAS_BOX_ROOM = 'w-full max-w-canvas lg:max-w-[min(var(--layout-canvas-max),calc(100dvh_-_13rem))]'
