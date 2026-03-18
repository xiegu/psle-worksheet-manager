// data/syllabus.js
// Single source of truth for PSLE 2026 topic taxonomy (MOE 2021 syllabus)
// NOTE: "Speed" is intentionally excluded from all topic lists — it is NOT in the 2026 PSLE syllabus.

const SYLLABUS = {
  P1: {
    "Numbers & Algebra": [
      "Whole Numbers (to 100)",
      "Addition & Subtraction",
      "Multiplication & Division",
      "Money"
    ],
    "Measurement & Geometry": [
      "Length (cm)",
      "Time",
      "2D Shapes"
    ],
    "Statistics": [
      "Picture Graphs"
    ]
  },

  P2: {
    "Numbers & Algebra": [
      "Whole Numbers (to 1,000)",
      "Fractions (intro)",
      "Money (dollars & cents)"
    ],
    "Measurement & Geometry": [
      "Length (m)",
      "Mass (kg, g)",
      "Volume of Liquid (l)",
      "Time (hours & minutes)",
      "2D & 3D Shapes"
    ],
    "Statistics": [
      "Graphs with Scales"
    ]
  },

  P3: {
    "Numbers & Algebra": [
      "Whole Numbers (to 10,000)",
      "Equivalent Fractions",
      "Money (addition & subtraction)"
    ],
    "Measurement & Geometry": [
      "Length (km)",
      "Volume (ml)",
      "Time (seconds, 24-hour clock)", // moved from P4 in 2021 syllabus
      "Area & Perimeter",
      "Angles & Lines"
    ],
    "Statistics": [
      "Bar Graphs"
    ]
  },

  P4: {
    "Numbers & Algebra": [
      "Whole Numbers (to 100,000)",
      "Factors & Multiples",
      "Fractions",
      "Decimals & Operations"
    ],
    "Measurement & Geometry": [
      "Area & Perimeter (squares, rectangles)",
      "Angles (degrees)",
      "Line Symmetry",
      "Nets of 3D Solids",      // moved from P6
      "Pie Charts (intro)"       // moved from P6
    ],
    "Statistics": [
      "Tables",
      "Line Graphs"
    ]
  },

  P5: {
    "Numbers & Algebra": [
      "Whole Numbers (to 10 million)",
      "Fractions",
      "Decimals",
      "Percentages",
      "Ratio",
      "Rate"
    ],
    "Measurement & Geometry": [
      "Area of Triangle",
      "Volume of Cube & Cuboid",
      "Angles",
      "Line Symmetry"
    ],
    "Statistics": []
  },

  P6: {
    "Numbers & Algebra": [
      "Fractions (no calculator)",
      "Percentages",
      "Ratio",
      "Algebra — Algebraic Expressions",   // NEW 2026
      "Algebra — Simple Linear Equations",  // NEW 2026
      "Average"                             // moved up from P5
    ],
    "Measurement & Geometry": [
      "Area & Circumference of Circle",
      "Volume of Cube & Cuboid (advanced)"
    ],
    "Statistics": [
      "Pie Charts"
    ]
  }
};

// 2026 syllabus change flags — always reference this object in UI, never hardcode labels elsewhere
const TOPIC_FLAGS = {
  "Algebra — Algebraic Expressions":   { flag: "new",        label: "New 2026" },
  "Algebra — Simple Linear Equations": { flag: "new",        label: "New 2026" },
  "Average":                           { flag: "moved_up",   label: "Moved to P6" },
  "Ratio":                             { flag: "moved_up",   label: "Moved to P6" },
  "Nets of 3D Solids":                 { flag: "moved_down", label: "Now in P4" },
  "Pie Charts (intro)":                { flag: "moved_down", label: "Now in P4" },
  "Time (seconds, 24-hour clock)":     { flag: "moved_down", label: "Now in P3" }
  // Speed is entirely absent — never appears in any topic list
};

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

/**
 * Returns the list of strand names for a given level.
 * @param {string} level - e.g. "P6"
 * @returns {string[]}
 */
function getStrands(level) {
  const levelData = SYLLABUS[level];
  if (!levelData) return [];
  return Object.keys(levelData);
}

/**
 * Returns the topic array for a given level and strand.
 * Strands with no topics return an empty array.
 * @param {string} level  - e.g. "P5"
 * @param {string} strand - e.g. "Numbers & Algebra"
 * @returns {string[]}
 */
function getTopics(level, strand) {
  const levelData = SYLLABUS[level];
  if (!levelData) return [];
  return levelData[strand] || [];
}

/**
 * Returns the flag object for a topic, or null if none.
 * @param {string} topic
 * @returns {{ flag: string, label: string } | null}
 */
function getFlag(topic) {
  return TOPIC_FLAGS[topic] || null;
}

/**
 * Guard: returns true if a topic string is "Speed" (case-insensitive).
 * Used by the builder to block worksheet creation for disallowed topics.
 * @param {string} topic
 * @returns {boolean}
 */
function isBlockedTopic(topic) {
  return topic.trim().toLowerCase() === "speed";
}
