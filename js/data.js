/*
 * Data for the Sideways color configurator.
 *
 * Products: official Carl Hansen & Søn product photos (public/), with
 * pre-generated upholstery masks (public/masks/) used for recoloring.
 *
 * Fabrics: swatch tiles cropped from the Carl Hansen fabric pages
 * (public/fabrics/). Each colorway's hex is the tile's measured average
 * color, used to re-tint the photos.
 */

const PRODUCTS = [
  {
    id: "sofa",
    name: "RF1903-L Sideways Soffa",
    short: "Soffa",
    views: [
      { label: "Framifrån", photo: "public/sideways-sofa-1.avif", mask: "public/masks/sideways-sofa-1-mask.png" },
      { label: "Snett framifrån", photo: "public/sideways-sofa-2.avif", mask: "public/masks/sideways-sofa-2-mask.png" },
      { label: "Bakifrån", photo: "public/sideways-sofa-3.avif", mask: "public/masks/sideways-sofa-3-mask.png" },
    ],
  },
  {
    id: "chair",
    name: "RF1904 Sideways Loungefåtölj",
    short: "Fåtölj",
    views: [
      { label: "Framifrån", photo: "public/sideways-chair-1.png", mask: "public/masks/sideways-chair-1-mask.png" },
      { label: "Snett framifrån", photo: "public/sideways-chair-2.png", mask: "public/masks/sideways-chair-2-mask.png" },
    ],
  },
];

const FABRICS = [
  {
    id: "canvas",
    name: "Canvas 2",
    info: "90% ull i worsted-kvalitet, 10% nylon",
    colors: [
      { code: "0114", tile: "public/fabrics/canvas-1.jpg", hex: "#aaa298" },
      { code: "0124", tile: "public/fabrics/canvas-2.jpg", hex: "#817e7b" },
      { code: "0134", tile: "public/fabrics/canvas-3.jpg", hex: "#5d5956" },
    ],
  },
  {
    id: "canvas-nature",
    name: "Canvas Natur",
    info: "100% naturlint",
    colors: [
      { code: "KK47000", tile: "public/fabrics/canvas-nature-1.jpg", hex: "#9a8368" },
    ],
  },
  {
    id: "capture",
    name: "Capture",
    info: "85% nyzeeländsk ull, 15% polyamid",
    colors: [
      { code: "4001", tile: "public/fabrics/capture-1.jpg", hex: "#96908e" },
      { code: "4101", tile: "public/fabrics/capture-2.jpg", hex: "#99948f" },
      { code: "4102", tile: "public/fabrics/capture-3.jpg", hex: "#9d9ba1" },
    ],
  },
  {
    id: "clara",
    name: "Clara 2",
    info: "92% ull i worsted-kvalitet, 8% nylon",
    colors: [
      { code: "0144", tile: "public/fabrics/clara-1.jpg", hex: "#bfbcb3" },
      { code: "0148", tile: "public/fabrics/clara-2.jpg", hex: "#9fa1a2" },
      { code: "0184", tile: "public/fabrics/clara-3.jpg", hex: "#4e4d49" },
    ],
  },
  {
    id: "fiord",
    name: "Fiord 2",
    info: "92% ull i worsted-kvalitet, 8% nylon",
    colors: [
      { code: "0101", tile: "public/fabrics/fiord-1.jpg", hex: "#a7a29d" },
      { code: "0121", tile: "public/fabrics/fiord-2.jpg", hex: "#9a9594" },
      { code: "0151", tile: "public/fabrics/fiord-3.jpg", hex: "#686664" },
    ],
  },
  {
    id: "mood",
    name: "Mood",
    info: "92% nyzeeländsk ull, 8% polyamid",
    colors: [
      { code: "1101", tile: "public/fabrics/mood-1.jpg", hex: "#b4b1aa" },
      { code: "1103", tile: "public/fabrics/mood-2.jpg", hex: "#9a8477" },
      { code: "1104", tile: "public/fabrics/mood-3.jpg", hex: "#cdc1ac" },
    ],
  },
  {
    id: "remix",
    name: "Remix 3",
    info: "90% ny ull i worsted-kvalitet, 10% nylon",
    colors: [
      { code: "0113", tile: "public/fabrics/remix-1.jpg", hex: "#ccbfa6" },
      { code: "0123", tile: "public/fabrics/remix-2.jpg", hex: "#797673" },
      { code: "0126", tile: "public/fabrics/remix-3.jpg", hex: "#89827c" },
    ],
  },
  {
    id: "rewool",
    name: "Re-wool",
    info: "45% ny ull, 45% återvunnen ull, 10% nylon",
    colors: [
      { code: "0108", tile: "public/fabrics/rewool-1.jpg", hex: "#7e7978" },
      { code: "0128", tile: "public/fabrics/rewool-2.jpg", hex: "#756d69" },
      { code: "0158", tile: "public/fabrics/rewool-3.jpg", hex: "#5e5956" },
    ],
  },
];
