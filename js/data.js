/*
 * Fabric data for the Carl Hansen & Søn "Sideways" series
 * (RF1903 Sideways Sofa and RF1904 Sideways Lounge Chair, design Rikke Frost).
 *
 * The fabric groups mirror Carl Hansen's "tyggrupper" (fabric price groups):
 *   Group 1: Clara 2, Remix 3, Capture, Focus Royal, Mood, Passion
 *   Group 2: Re-wool 2
 *   Group 3: Fiord 2, Hallingdal 65
 *   Group 4: Divina Melange 3, Keiga
 *
 * Hex values are visual approximations of the real Kvadrat/Gabriel colorways.
 */

const FABRIC_GROUPS = [
  {
    id: "group1",
    name: "Tyggrupp 1",
    fabrics: [
      {
        id: "clara2",
        name: "Clara 2",
        maker: "Kvadrat",
        colors: [
          { code: "114", name: "Ivory", hex: "#e6e0d2" },
          { code: "144", name: "Sand", hex: "#d3c5aa" },
          { code: "154", name: "Ljusgrå", hex: "#c3c0b8" },
          { code: "174", name: "Grå", hex: "#8f8d86" },
          { code: "184", name: "Mörkgrå", hex: "#575550" },
          { code: "194", name: "Antracit", hex: "#3a3a3b" },
          { code: "244", name: "Gyllengul", hex: "#d2a13f" },
          { code: "344", name: "Röd", hex: "#a53a3c" },
          { code: "454", name: "Blå", hex: "#4c648c" },
          { code: "484", name: "Marinblå", hex: "#2f3c58" },
          { code: "554", name: "Petrol", hex: "#37616b" },
          { code: "784", name: "Grön", hex: "#5d7255" },
        ],
      },
      {
        id: "remix3",
        name: "Remix 3",
        maker: "Kvadrat",
        colors: [
          { code: "113", name: "Naturvit", hex: "#ddd8cb" },
          { code: "123", name: "Ljusgrå", hex: "#c4c2ba" },
          { code: "143", name: "Grå", hex: "#999790" },
          { code: "163", name: "Mörkgrå", hex: "#6e6c66" },
          { code: "183", name: "Antracit", hex: "#3f3e3b" },
          { code: "233", name: "Sand", hex: "#c9b892" },
          { code: "252", name: "Gyllengul", hex: "#c9a13b" },
          { code: "373", name: "Brun", hex: "#7a6a55" },
          { code: "433", name: "Oliv", hex: "#8a8a4f" },
          { code: "612", name: "Ljusblå", hex: "#9fb3c8" },
          { code: "682", name: "Blå", hex: "#47628c" },
          { code: "743", name: "Marinblå", hex: "#354764" },
          { code: "852", name: "Röd", hex: "#a03d34" },
          { code: "873", name: "Vinröd", hex: "#6e3441" },
          { code: "933", name: "Grön", hex: "#5c7355" },
          { code: "982", name: "Mörk petrol", hex: "#35555a" },
        ],
      },
      {
        id: "capture",
        name: "Capture",
        maker: "Gabriel",
        colors: [
          { code: "4101", name: "Ljusgrå", hex: "#c7c5c0" },
          { code: "4201", name: "Sand", hex: "#cbbfa4" },
          { code: "4301", name: "Grå", hex: "#918f8a" },
          { code: "4401", name: "Antracit", hex: "#4b4a47" },
          { code: "4501", name: "Ockra", hex: "#b98f3e" },
          { code: "4601", name: "Petrol", hex: "#3d5f66" },
          { code: "4701", name: "Blå", hex: "#4a6288" },
          { code: "4801", name: "Bordeaux", hex: "#6f3543" },
          { code: "4901", name: "Grön", hex: "#5f6f52" },
          { code: "5001", name: "Svart", hex: "#333333" },
        ],
      },
      {
        id: "focusroyal",
        name: "Focus Royal",
        maker: "Gabriel",
        colors: [
          { code: "1010", name: "Naturvit", hex: "#e2ddd0" },
          { code: "1020", name: "Ljusgrå", hex: "#c2c0ba" },
          { code: "1030", name: "Grå", hex: "#8d8b85" },
          { code: "1040", name: "Antracit", hex: "#484743" },
          { code: "1050", name: "Senapsgul", hex: "#c19a3d" },
          { code: "1060", name: "Rost", hex: "#9e5a3e" },
          { code: "1070", name: "Röd", hex: "#9c3d38" },
          { code: "1080", name: "Blå", hex: "#45608a" },
          { code: "1090", name: "Marinblå", hex: "#303e5a" },
          { code: "1100", name: "Grön", hex: "#587053" },
        ],
      },
      {
        id: "mood",
        name: "Mood",
        maker: "Gabriel",
        colors: [
          { code: "2101", name: "Ivory", hex: "#e4dfd3" },
          { code: "2201", name: "Beige", hex: "#cfc2a8" },
          { code: "2301", name: "Ljusgrå", hex: "#c5c3bd" },
          { code: "2401", name: "Grå", hex: "#8f8d87" },
          { code: "2501", name: "Mörkgrå", hex: "#53514d" },
          { code: "2601", name: "Dovt rosa", hex: "#c7a49c" },
          { code: "2701", name: "Terrakotta", hex: "#a8624a" },
          { code: "2801", name: "Petrol", hex: "#39626c" },
          { code: "2901", name: "Blå", hex: "#4a638c" },
          { code: "3001", name: "Grön", hex: "#5e7457" },
        ],
      },
      {
        id: "passion",
        name: "Passion",
        maker: "Gabriel",
        colors: [
          { code: "3101", name: "Ljusgrå", hex: "#c9c7c1" },
          { code: "3201", name: "Grå", hex: "#93918b" },
          { code: "3301", name: "Antracit", hex: "#4a4945" },
          { code: "3401", name: "Gul", hex: "#d0a838" },
          { code: "3501", name: "Orange", hex: "#c26a35" },
          { code: "3601", name: "Röd", hex: "#a83732" },
          { code: "3701", name: "Cerise", hex: "#a33d63" },
          { code: "3801", name: "Blå", hex: "#3f5c8c" },
          { code: "3901", name: "Turkos", hex: "#3d8a88" },
          { code: "4001", name: "Grön", hex: "#567a4e" },
        ],
      },
    ],
  },
  {
    id: "group2",
    name: "Tyggrupp 2",
    fabrics: [
      {
        id: "rewool2",
        name: "Re-wool 2",
        maker: "Kvadrat",
        colors: [
          { code: "0108", name: "Beige", hex: "#cfc4ae" },
          { code: "0128", name: "Ljusgrå", hex: "#bdbab2" },
          { code: "0198", name: "Grå", hex: "#85827a" },
          { code: "0218", name: "Antracit", hex: "#4c4a45" },
          { code: "0358", name: "Ockragul", hex: "#bd9440" },
          { code: "0458", name: "Rost", hex: "#9c5a3c" },
          { code: "0568", name: "Röd", hex: "#973f38" },
          { code: "0658", name: "Blå", hex: "#4a5f80" },
          { code: "0778", name: "Mörkblå", hex: "#33415c" },
          { code: "0858", name: "Grön", hex: "#566349" },
        ],
      },
    ],
  },
  {
    id: "group3",
    name: "Tyggrupp 3",
    fabrics: [
      {
        id: "fiord2",
        name: "Fiord 2",
        maker: "Kvadrat",
        colors: [
          { code: "101", name: "Ivory melange", hex: "#e3ded2" },
          { code: "151", name: "Ljusgrå melange", hex: "#c6c4be" },
          { code: "171", name: "Grå melange", hex: "#9a9892" },
          { code: "191", name: "Antracit melange", hex: "#4d4d4b" },
          { code: "201", name: "Ljus gråblå", hex: "#b7c0c4" },
          { code: "251", name: "Blå melange", hex: "#55708c" },
          { code: "271", name: "Mörkblå melange", hex: "#3a4a63" },
          { code: "351", name: "Grön melange", hex: "#62755f" },
          { code: "371", name: "Mörkgrön melange", hex: "#42503f" },
          { code: "451", name: "Petrol melange", hex: "#38626b" },
          { code: "551", name: "Natur melange", hex: "#cfc4ad" },
          { code: "571", name: "Rost melange", hex: "#a05c44" },
          { code: "961", name: "Ljusrosa melange", hex: "#d8c4bc" },
        ],
      },
      {
        id: "hallingdal65",
        name: "Hallingdal 65",
        maker: "Kvadrat",
        colors: [
          { code: "100", name: "Naturvit", hex: "#e6e3da" },
          { code: "103", name: "Ljusbeige", hex: "#d8d2c2" },
          { code: "110", name: "Varmgrå", hex: "#b8ab97" },
          { code: "123", name: "Ljusgrå", hex: "#c9c9c5" },
          { code: "130", name: "Grå melange", hex: "#a7a7a3" },
          { code: "166", name: "Mellangrå", hex: "#83837f" },
          { code: "180", name: "Mörkgrå", hex: "#4a4a48" },
          { code: "190", name: "Nästan svart", hex: "#2f2f2e" },
          { code: "227", name: "Röd", hex: "#b03a30" },
          { code: "407", name: "Gyllengul", hex: "#c9962e" },
          { code: "547", name: "Orange", hex: "#c96a35" },
          { code: "600", name: "Ljusblå", hex: "#aebfd0" },
          { code: "680", name: "Koboltblå", hex: "#2f4d8a" },
          { code: "754", name: "Marinblå", hex: "#2c3550" },
          { code: "764", name: "Teal", hex: "#2e6f77" },
          { code: "840", name: "Vinröd", hex: "#7a2f38" },
          { code: "907", name: "Grön", hex: "#4d6b4f" },
          { code: "960", name: "Turkos", hex: "#3e8f8a" },
        ],
      },
    ],
  },
  {
    id: "group4",
    name: "Tyggrupp 4",
    fabrics: [
      {
        id: "divinamelange3",
        name: "Divina Melange 3",
        maker: "Kvadrat",
        colors: [
          { code: "120", name: "Ljusgrå", hex: "#ccc9c3" },
          { code: "220", name: "Grå", hex: "#98958f" },
          { code: "260", name: "Antracit", hex: "#504e4b" },
          { code: "344", name: "Kamel", hex: "#b98d54" },
          { code: "421", name: "Rosa", hex: "#c99a94" },
          { code: "531", name: "Röd", hex: "#a83a34" },
          { code: "581", name: "Vinröd", hex: "#6f3040" },
          { code: "631", name: "Ljusblå", hex: "#a9bccd" },
          { code: "680", name: "Blå", hex: "#3d5a8c" },
          { code: "747", name: "Marinblå", hex: "#2f3d58" },
          { code: "871", name: "Petrol", hex: "#35606a" },
          { code: "921", name: "Grön", hex: "#5d7457" },
          { code: "971", name: "Mörkgrön", hex: "#3d4f41" },
        ],
      },
      {
        id: "keiga",
        name: "Keiga",
        maker: "Kvadrat",
        colors: [
          { code: "130", name: "Ivory", hex: "#e2dccd" },
          { code: "220", name: "Sand", hex: "#c9bb9e" },
          { code: "330", name: "Grå", hex: "#94918a" },
          { code: "440", name: "Antracit", hex: "#4a4945" },
          { code: "550", name: "Terrakotta", hex: "#a55f44" },
          { code: "640", name: "Blå", hex: "#48618a" },
          { code: "740", name: "Marinblå", hex: "#313f5c" },
          { code: "750", name: "Petrol", hex: "#376068" },
          { code: "840", name: "Vinröd", hex: "#71333f" },
          { code: "940", name: "Grön", hex: "#586e50" },
        ],
      },
    ],
  },
];

const WOOD_FINISHES = [
  { id: "oak-oil", name: "Ek, olja", hex: "#c89a63" },
  { id: "oak-white-oil", name: "Ek, vitolja", hex: "#dcc8a6" },
  { id: "oak-smoked-oil", name: "Ek, rökfärgad olja", hex: "#8a664a" },
  { id: "walnut-oil", name: "Valnöt, olja", hex: "#6f4e37" },
];

const CORD_COLOR = "#d9c49a"; // natural paper cord

const PRODUCTS = [
  { id: "sofa", name: "RF1903-L Sideways Soffa", short: "Soffa" },
  { id: "chair", name: "RF1904 Sideways Loungefåtölj", short: "Fåtölj" },
];
