// A seeded profile: 14 graded rounds over the last 18 days. Exported for the e2e scripts.
export function seed(now = Date.now()) {
  const pid = 'prf_seeded1';
  const DAY = 86400000;
  const M = {
    mito: ['Photosynthesis happens in the mitochondria', 'swapped_terms', 'biology', 'Photosynthesis: light-dependent reactions'],
    glucose: ['Light reactions make glucose directly', 'wrong_mechanism', 'biology', 'Photosynthesis: light-dependent reactions'],
    green: ['Chlorophyll absorbs mostly green light', 'wrong_quantity_or_value', 'biology', 'Photosynthesis: light-dependent reactions'],
    somme: ['The Somme came before Verdun', 'wrong_sequence', 'history', 'Causes of the First World War'],
    austria: ['The Schlieffen Plan was Austrian', 'wrong_attribution', 'history', 'Causes of the First World War'],
    evap: ['Evaporation only happens at 100 °C', 'false_generalisation', 'geography', 'The water cycle'],
    clouds: ['Clouds are made of water vapour', 'swapped_terms', 'geography', 'The water cycle'],
    demand: ['Higher prices raise demand', 'reversed_causation', 'economics', 'Supply and demand'],
  };
  // [daysAgo, [[key, outcome, conf]], falseFlagConfs, foundAll]
  const plan = [
    [18, [['mito', 'missed'], ['glucose', 'caught', 0.9]], [0.7], 0.9],
    [16, [['somme', 'missed'], ['austria', 'caught', 0.8]], [], 0.8],
    [15, [['evap', 'caught', 0.9], ['clouds', 'missed']], [0.9], 0.9],
    [13, [['mito', 'missed'], ['green', 'half', 0.8]], [], 0.9],
    [12, [['demand', 'missed'], ['somme', 'caught', 0.6]], [0.8], 0.7],
    [10, [['clouds', 'missed'], ['evap', 'caught', 1]], [], 1],
    [9, [['glucose', 'missed'], ['mito', 'caught', 0.7]], [0.9], 0.8],
    [7, [['austria', 'half', 0.9], ['somme', 'missed']], [], 0.9],
    [6, [['green', 'missed'], ['glucose', 'caught', 0.9]], [0.6], 0.6],
    [5, [['demand', 'missed'], ['clouds', 'caught', 0.8]], [], 0.9],
    [4, [['mito', 'missed'], ['green', 'caught', 0.9]], [0.9], 1],
    [3, [['evap', 'caught', 0.8], ['clouds', 'caught', 0.9]], [], 0.7],
    [2, [['somme', 'caught', 0.9], ['austria', 'missed']], [0.7], 0.8],
    [1, [['glucose', 'missed'], ['demand', 'caught', 0.6]], [], 0.9],
  ];
  const rounds = {};
  plan.forEach(([ago, errs, ffs, foundAll], n) => {
    const at = new Date(now - ago * DAY).toISOString();
    const id = `rnd_seed${n}`;
    const first = M[errs[0][0]];
    const errors = errs.map(([k], i) => ({ sentenceId: `s${i + 2}`, originalSentence: `The accurate version of: ${M[k][0].toLowerCase()} (corrected).`, sabotagedSentence: `A sentence that claims ${M[k][0].toLowerCase()}.`, errorType: M[k][1], explanation: `This is wrong: in fact the opposite holds for "${M[k][0]}".`, whyTempting: 'It sounds right because the words are often used together.', misconceptionLabel: M[k][0] }));
    const items = [
      ...errs.map(([, o, c], i) => (o === 'missed' ? { sentenceId: `s${i + 2}`, kind: 'miss', feedback: '', points: 0 } : { sentenceId: `s${i + 2}`, kind: 'catch', correctionGrade: o === 'half' ? 'incorrect' : 'correct', confidence: c, feedback: '', points: 100 })),
      ...ffs.map((c, i) => ({ sentenceId: `s${i + 6}`, kind: 'false_flag', confidence: c, feedback: '', points: -25 })),
    ];
    const sentences = Array.from({ length: 8 }, (_, i) => ({ id: `s${i + 1}`, text: `Sentence ${i + 1}.` }));
    rounds[id] = {
      round: { id, topic: first[3], topicId: first[3].toLowerCase().replace(/\W+/g, '-'), level: 'A-level / high school', difficulty: 'subtle', sentences, createdAt: at, engine: 'offline', subject: first[2] },
      submission: { roundId: id, flags: [], foundAllConfidence: foundAll },
      result: { roundId: id, items, errors, score: 150, maxScore: 300 },
      playedAt: at,
    };
  });
  const iso = new Date(now).toISOString();
  return {
    'saboteur:v2:meta': { schemaVersion: 2, activeProfileId: pid, profileOrder: [pid] },
    [`saboteur:v2:p:${pid}:profile`]: { id: pid, name: 'Ada', avatar: { kind: 'pin', id: 'owl' }, createdAt: iso, lastActiveAt: iso },
    [`saboteur:v2:p:${pid}:stats`]: {},
    [`saboteur:v2:p:${pid}:rounds`]: rounds,
  };
}
export async function applySeed(page, base) {
  await page.goto(base + '/about');
  await page.evaluate((data) => { localStorage.clear(); for (const [k, v] of Object.entries(data)) localStorage.setItem(k, JSON.stringify(v)); }, seed());
}
