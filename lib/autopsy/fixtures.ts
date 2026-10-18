// Fifteen hand-made marked worksheets (V07 acceptance): three each in maths, physics, chemistry, biology
// and economics. Every item says what a good diagnosis looks like, and some wrong answers are planted
// slips. The mock answers from these (lib/mock.ts), and scripts/eval/autopsy.ts scores a real model
// against them for manual review.
import type { ErrorType } from "../schemas";

export interface FixtureItem {
  question: string;
  answer: string;
  correct: string;
  expect: {
    kind: "misconception" | "careless_slip";
    label: string;
    errorType: ErrorType | null;
    explanation: string;
    correction: string;
  };
}

export interface Worksheet {
  subject: string;
  level: string;
  title: string;
  items: FixtureItem[];
}

const m = (label: string, errorType: ErrorType, explanation: string, correction: string) => ({ kind: "misconception" as const, label, errorType, explanation, correction });
const slip = (label: string, explanation: string, correction: string) => ({ kind: "careless_slip" as const, label, errorType: null, explanation, correction });

export const WORKSHEETS: Worksheet[] = [
  {
    subject: "maths",
    level: "GCSE / middle school",
    title: "Algebra: expanding and solving",
    items: [
      { question: "Expand (x + 3)²", answer: "x² + 9", correct: "x² + 6x + 9", expect: m("Squaring a bracket squares each term separately", "false_generalisation", "Squaring x and 3 separately gives x² + 9 and drops the 2 × 3x cross term.", "(x + 3)² means (x + 3)(x + 3), so there are two 3x terms: x² + 6x + 9.") },
      { question: "Solve 2x + 5 = 17", answer: "x = 12", correct: "x = 6", expect: m("Removing the + 5 is enough; the 2 in front of x is ignored", "missing_exception", "Subtracted 5 from 17 to get 12 but treated 2x as if it were x, so never divided by 2.", "Undo both steps: subtract 5 (2x = 12), then divide by 2 (x = 6).") },
      { question: "Simplify 3a × 4a", answer: "12a", correct: "12a²", expect: m("Multiplying like terms keeps the same power", "false_generalisation", "Treats a × a as a, as if multiplying were adding like terms.", "a × a = a², so 3a × 4a = 12a².") },
      { question: "Work out 7 × 8 − 6", answer: "48", correct: "50", expect: slip("Arithmetic slip: 56 − 6 written as 48", "The method (multiply first, then subtract) is right; 56 − 6 was miscalculated.", "56 − 6 = 50.") },
    ],
  },
  {
    subject: "maths",
    level: "A-level / high school",
    title: "Differentiation",
    items: [
      { question: "Differentiate x³", answer: "3x", correct: "3x²", expect: m("The power drops to 1 when differentiating", "wrong_mechanism", "Brought the 3 down but replaced the power with 1 instead of reducing it by one.", "d/dx xⁿ = nxⁿ⁻¹, so x³ becomes 3x².") },
      { question: "Differentiate sin x", answer: "−cos x", correct: "cos x", expect: m("The derivative of sin x is −cos x", "swapped_terms", "Mixed up the derivative of sin x with its integral (−cos x).", "d/dx sin x = cos x; it's the integral of sin x that is −cos x.") },
      { question: "Differentiate (2x + 1)³", answer: "3(2x + 1)²", correct: "6(2x + 1)²", expect: m("The chain rule isn't needed for a bracket to a power", "missing_exception", "Applied the power rule to the bracket but didn't multiply by the derivative of the inside (2).", "Chain rule: 3(2x + 1)² × 2 = 6(2x + 1)².") },
      { question: "Find dy/dx when y = 5x²", answer: "10", correct: "10x", expect: slip("Dropped the x from the final answer", "The coefficient (10) is right, so the power rule was applied; the x was left off when writing it down.", "dy/dx = 10x.") },
    ],
  },
  {
    subject: "maths",
    level: "GCSE / middle school",
    title: "Fractions and percentages",
    items: [
      { question: "Work out 1/2 + 1/3", answer: "2/5", correct: "5/6", expect: m("Fractions add by adding tops and bottoms", "wrong_mechanism", "Added the numerators (1 + 1) and the denominators (2 + 3).", "Use a common denominator: 3/6 + 2/6 = 5/6.") },
      { question: "A £40 jumper is reduced by 25%. What is the new price?", answer: "£10", correct: "£30", expect: m("The discount worked out is the new price", "swapped_terms", "Worked out 25% of £40 (£10) correctly, then gave the amount taken off as the price.", "25% of £40 is £10 off, so the new price is £40 − £10 = £30.") },
      { question: "Increase 80 by 10%, then decrease the result by 10%", answer: "80", correct: "79.2", expect: m("A percentage increase and the same percentage decrease cancel out", "false_generalisation", "Assumed +10% then −10% returns to the start, but the 10% decrease is taken from the bigger number (88).", "80 × 1.1 = 88, then 88 × 0.9 = 79.2.") },
    ],
  },
  {
    subject: "physics",
    level: "GCSE / middle school",
    title: "Electric circuits",
    items: [
      { question: "Two 6 Ω resistors are connected in parallel. What is the total resistance?", answer: "12 Ω", correct: "3 Ω", expect: m("Resistances in parallel add up like in series", "false_generalisation", "Added the two resistances, which is the rule for series.", "In parallel the total is less than either: 1/R = 1/6 + 1/6, so R = 3 Ω.") },
      { question: "What happens to the current in a series circuit as it passes through a bulb?", answer: "It gets used up, so it's smaller after the bulb", correct: "It stays the same all the way round", expect: m("Current is used up by components", "wrong_mechanism", "Thinks the bulb consumes current, when it's energy that's transferred.", "Current is the same everywhere in a series circuit; the bulb transfers energy, not charge.") },
      { question: "Calculate the power of a 230 V appliance drawing 2 A.", answer: "115 W", correct: "460 W", expect: m("Power is voltage divided by current", "wrong_mechanism", "Divided 230 by 2 instead of multiplying.", "P = V × I = 230 × 2 = 460 W.") },
      { question: "What is the unit of charge?", answer: "Columbs", correct: "Coulombs", expect: slip("Spelling slip", "Coulomb is the right unit, just misspelt.", "Coulomb (C).") },
    ],
  },
  {
    subject: "physics",
    level: "A-level / high school",
    title: "Forces and motion",
    items: [
      { question: "A ball is thrown straight up. What is its acceleration at the highest point?", answer: "Zero", correct: "9.8 m/s² downwards", expect: m("Acceleration is zero when velocity is zero", "swapped_terms", "Confuses velocity (zero at the top) with acceleration.", "Gravity still acts at the top, so acceleration is 9.8 m/s² downwards even though the velocity is momentarily zero.") },
      { question: "A car moves at constant velocity. What is the resultant force on it?", answer: "Forwards, equal to the engine force", correct: "Zero", expect: m("A moving object needs a resultant force to keep moving", "false_generalisation", "Thinks motion requires a net forward force.", "Constant velocity means no acceleration, so the forces balance: resultant force is zero (Newton's first law).") },
      { question: "A 2 kg mass accelerates at 3 m/s². What is the resultant force?", answer: "5 N", correct: "6 N", expect: slip("Added instead of multiplied", "F = ma is the right idea; 2 and 3 were added by mistake.", "F = 2 × 3 = 6 N.") },
    ],
  },
  {
    subject: "physics",
    level: "GCSE / middle school",
    title: "Waves and energy",
    items: [
      { question: "Can sound travel through a vacuum?", answer: "Yes, more easily because nothing is in the way", correct: "No, it needs a medium", expect: m("Sound travels best through empty space", "reversed_causation", "Thinks the medium slows sound, when the medium is what carries it.", "Sound is a vibration of particles, so with no particles it can't travel.") },
      { question: "Which has the higher frequency, radio waves or X-rays?", answer: "Radio waves", correct: "X-rays", expect: m("Longer waves have higher frequency", "reversed_causation", "Linked long wavelength with high frequency, the wrong way round.", "Frequency and wavelength are inversely related: X-rays are short and high-frequency.") },
      { question: "A wave has frequency 50 Hz and wavelength 4 m. What is its speed?", answer: "12.5 m/s", correct: "200 m/s", expect: m("Wave speed is frequency divided by wavelength", "wrong_mechanism", "Divided 50 by 4 instead of multiplying.", "v = fλ = 50 × 4 = 200 m/s.") },
    ],
  },
  {
    subject: "chemistry",
    level: "GCSE / middle school",
    title: "Atomic structure",
    items: [
      { question: "What is the atomic number of carbon?", answer: "12", correct: "6", expect: m("Atomic number is the mass number", "swapped_terms", "Gave carbon's mass number (12) instead of its proton number.", "Atomic number = number of protons = 6; 12 is the mass number.") },
      { question: "How many neutrons are in an atom of sodium-23 (atomic number 11)?", answer: "23", correct: "12", expect: m("The mass number is the number of neutrons", "swapped_terms", "Took the mass number as the neutron count.", "Neutrons = mass number − protons = 23 − 11 = 12.") },
      { question: "What is the charge on an electron?", answer: "Positive", correct: "Negative", expect: m("Electrons are positive", "swapped_terms", "Swapped the charges of the electron and proton.", "Electrons are negative (−1); protons are positive.") },
      { question: "How many electrons can the first shell hold?", answer: "8", correct: "2", expect: m("Every shell holds eight electrons", "false_generalisation", "Applied the 'eight' rule for outer shells to the first shell.", "The first shell holds 2; the next shells hold up to 8 at this level.") },
    ],
  },
  {
    subject: "chemistry",
    level: "A-level / high school",
    title: "Rates and equilibrium",
    items: [
      { question: "What does a catalyst do to the position of equilibrium?", answer: "Shifts it to the right", correct: "Nothing: it speeds up both directions equally", expect: m("Catalysts push equilibrium towards the products", "false_generalisation", "Thinks a catalyst favours the forward reaction.", "A catalyst lowers the activation energy for both directions, so equilibrium is reached faster but its position doesn't change.") },
      { question: "Why does increasing temperature increase the rate of reaction?", answer: "It lowers the activation energy", correct: "More particles have energy above the activation energy", expect: m("Heating lowers the activation energy", "wrong_mechanism", "Credits temperature with what a catalyst does.", "Temperature doesn't change the activation energy; more collisions have at least that energy.") },
      { question: "Calculate the moles in 18 g of water (Mr = 18).", answer: "10 mol", correct: "1 mol", expect: slip("Arithmetic slip: 18 ÷ 18 written as 10", "n = m/Mr is the right method; the division was miscopied.", "n = 18 ÷ 18 = 1 mol.") },
    ],
  },
  {
    subject: "chemistry",
    level: "GCSE / middle school",
    title: "Bonding and acids",
    items: [
      { question: "Why does sodium chloride have a high melting point?", answer: "Strong covalent bonds between the molecules", correct: "Strong electrostatic forces between oppositely charged ions in a giant lattice", expect: m("Ionic compounds are made of molecules with covalent bonds", "swapped_terms", "Described ionic bonding as covalent bonding between molecules.", "NaCl is a giant ionic lattice held by strong attractions between Na⁺ and Cl⁻ ions.") },
      { question: "What is the pH of a strong acid?", answer: "13", correct: "About 1", expect: m("A stronger acid has a higher pH", "reversed_causation", "Thinks pH rises with acidity.", "The lower the pH, the more acidic: strong acids are around 0–2.") },
      { question: "Name the salt formed from hydrochloric acid and sodium hydroxide.", answer: "Sodium chlorate", correct: "Sodium chloride", expect: slip("Wrong ending: chlorate for chloride", "The salt is named the right way (sodium + acid part); the -ide ending slipped.", "Hydrochloric acid gives chlorides: sodium chloride.") },
    ],
  },
  {
    subject: "biology",
    level: "GCSE / middle school",
    title: "Cells and respiration",
    items: [
      { question: "What is the function of mitochondria?", answer: "To make proteins", correct: "Aerobic respiration, releasing energy", expect: m("Mitochondria make proteins", "swapped_terms", "Gave the job of ribosomes.", "Mitochondria are the site of aerobic respiration; ribosomes make proteins.") },
      { question: "Do plant cells respire?", answer: "No, they photosynthesise instead", correct: "Yes, all the time", expect: m("Plants photosynthesise instead of respiring", "false_generalisation", "Thinks photosynthesis replaces respiration in plants.", "Plants respire all the time, day and night; they also photosynthesise when there is light.") },
      { question: "What are the products of anaerobic respiration in muscles?", answer: "Lactic acid and carbon dioxide", correct: "Lactic acid", expect: m("Anaerobic respiration in muscles makes carbon dioxide", "plausible_but_false_detail", "Mixed in a product of anaerobic respiration in yeast.", "In muscles the only product is lactic acid; yeast makes ethanol and carbon dioxide.") },
      { question: "What is the word equation for aerobic respiration?", answer: "glucose + oxygen → carbon dioxide + water", correct: "glucose + oxygen → carbon dioxide + water (+ energy released)", expect: slip("Left off that energy is released", "The equation is right; the note that energy is released was left out.", "glucose + oxygen → carbon dioxide + water, releasing energy.") },
    ],
  },
  {
    subject: "biology",
    level: "A-level / high school",
    title: "Genetics and enzymes",
    items: [
      { question: "What happens to an enzyme at very high temperature?", answer: "It is killed", correct: "It denatures: its active site changes shape", expect: m("Enzymes are alive and can be killed", "wrong_mechanism", "Treats enzymes as living things.", "Enzymes are proteins; heat breaks the bonds holding the active site's shape, so it denatures.") },
      { question: "Where is DNA transcribed into mRNA in a eukaryotic cell?", answer: "In the ribosomes", correct: "In the nucleus", expect: m("Transcription happens at ribosomes", "swapped_terms", "Confused transcription with translation.", "Transcription happens in the nucleus; translation happens at ribosomes.") },
      { question: "Two heterozygous parents (Aa × Aa). What fraction of offspring are expected to be homozygous recessive?", answer: "1/2", correct: "1/4", expect: m("Heterozygous parents give half recessive offspring", "wrong_quantity_or_value", "Counted the 'a' alleles (half) rather than the aa genotypes.", "The Punnett square gives AA, Aa, Aa, aa: one in four is aa.") },
    ],
  },
  {
    subject: "biology",
    level: "GCSE / middle school",
    title: "Circulation and photosynthesis",
    items: [
      { question: "Which blood vessels carry blood away from the heart?", answer: "Veins", correct: "Arteries", expect: m("Veins carry blood away from the heart", "swapped_terms", "Swapped arteries and veins.", "Arteries carry blood away from the heart; veins carry it back.") },
      { question: "Where does the mass of a tree mostly come from?", answer: "From the soil", correct: "From carbon dioxide in the air", expect: m("Plants get their mass from the soil", "wrong_mechanism", "Thinks the minerals or soil build the tree.", "Most of the mass is carbon fixed from CO₂ in photosynthesis.") },
      { question: "What gas is produced in photosynthesis?", answer: "Carbon dioxide", correct: "Oxygen", expect: m("Photosynthesis gives off carbon dioxide", "reversed_causation", "Swapped the reactant and product gases.", "Photosynthesis takes in CO₂ and gives off O₂.") },
    ],
  },
  {
    subject: "economics",
    level: "A-level / high school",
    title: "Demand and supply",
    items: [
      { question: "If the price of a good rises, what happens to its demand curve?", answer: "It shifts left", correct: "It doesn't shift; there's a movement along it", expect: m("A price change shifts the demand curve", "wrong_mechanism", "Confused a movement along the curve with a shift.", "A price change moves along the demand curve; only non-price factors shift it.") },
      { question: "What happens to equilibrium price if supply increases?", answer: "It rises", correct: "It falls", expect: m("More supply raises the price", "reversed_causation", "Reversed the effect of a supply increase.", "Supply shifts right, so at the old price there's a surplus and price falls.") },
      { question: "Price elasticity of demand: price rises 10%, quantity falls 20%. PED?", answer: "−0.5", correct: "−2", expect: m("PED is the price change over the quantity change", "swapped_terms", "Divided the % price change by the % quantity change.", "PED = %ΔQ / %ΔP = −20 / 10 = −2.") },
    ],
  },
  {
    subject: "economics",
    level: "A-level / high school",
    title: "Macroeconomics",
    items: [
      { question: "What does inflation of 3% mean?", answer: "Prices are 3% higher than 3 years ago", correct: "The general price level is 3% higher than a year ago", expect: m("Inflation measures change over several years", "plausible_but_false_detail", "Attached the rate to the wrong time span.", "Inflation is the annual percentage rise in the general price level.") },
      { question: "What happens to unemployment in a recession?", answer: "It falls", correct: "It rises", expect: m("Recessions reduce unemployment", "reversed_causation", "Reversed the link between output and jobs.", "In a recession output falls, firms cut jobs, and unemployment rises.") },
      { question: "If the central bank raises interest rates, what happens to borrowing?", answer: "It rises", correct: "It falls", expect: m("Higher interest rates encourage borrowing", "reversed_causation", "Thinks higher rates make borrowing more attractive.", "Higher rates make borrowing dearer, so borrowing falls.") },
    ],
  },
  {
    subject: "economics",
    level: "GCSE / middle school",
    title: "Costs and markets",
    items: [
      { question: "Is rent on a factory a fixed or variable cost?", answer: "Variable", correct: "Fixed", expect: m("Costs paid regularly are variable", "swapped_terms", "Mixed up fixed and variable costs.", "Rent doesn't change with output, so it's a fixed cost.") },
      { question: "Profit = revenue − costs. Revenue £500, costs £320. Profit?", answer: "£280", correct: "£180", expect: slip("Subtraction slip", "The formula is right; 500 − 320 was miscalculated.", "£500 − £320 = £180.") },
      { question: "What is a monopoly?", answer: "A market with a few large firms", correct: "A market with a single seller", expect: m("A monopoly is a market of a few big firms", "swapped_terms", "Described an oligopoly.", "A monopoly has one seller; a few large firms is an oligopoly.") },
    ],
  },
];

/** Find the fixture item for a question, by its text. */
export function fixtureFor(question: string): (FixtureItem & { subject: string; title: string }) | null {
  const q = question.trim().toLowerCase();
  for (const w of WORKSHEETS) for (const i of w.items) if (i.question.toLowerCase() === q) return { ...i, subject: w.subject, title: w.title };
  return null;
}
