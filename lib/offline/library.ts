// Hand-checked passages for offline play. Each sentence is accurate at roughly GCSE/A-level.
// Some entries also carry hand-written errors, which beat rule-based ones; the rules fill any gaps.
import type { ErrorType } from "../schemas";
import { EXTRA } from "./library-extra";

export interface CuratedError {
  sabotaged: string;
  type: ErrorType;
  explanation: string;
  tempting: string;
  label: string;
}

export interface LibraryEntry {
  id: string;
  title: string;
  /** School subject: the daily case rotates through these. */
  subject: string;
  /** Who checked the entry against a textbook (backlog B-01), or "unreviewed". */
  reviewer?: string;
  match: RegExp;
  sentences: string[];
  /** Keyed by sentence index. */
  errors: Record<number, CuratedError>;
}

const CORE: LibraryEntry[] = [
  {
    id: "photosynthesis",
    title: "Photosynthesis",
    subject: "biology",
    match: /photosynth|chloroplast|calvin|light[- ]dependent/i,
    sentences: [
      "Photosynthesis converts light energy into chemical energy stored in glucose.",
      "It takes place in chloroplasts, which contain the green pigment chlorophyll.",
      "The overall reaction uses carbon dioxide and water and releases oxygen.",
      "The process has two stages: the light-dependent reactions and the Calvin cycle.",
      "The light-dependent reactions take place in the thylakoid membranes.",
      "There, water is split by photolysis, which releases oxygen as a by-product.",
      "Electrons passed along the electron transport chain drive the production of ATP.",
      "Reduced NADP is also produced and carries hydrogen to the Calvin cycle.",
      "The Calvin cycle takes place in the stroma of the chloroplast.",
      "The enzyme RuBisCO fixes carbon dioxide by combining it with ribulose bisphosphate.",
      "ATP and reduced NADP are used to convert glycerate 3-phosphate into triose phosphate.",
      "Some triose phosphate is used to regenerate ribulose bisphosphate so the cycle can continue.",
    ],
    errors: {
      4: { sabotaged: "The light-dependent reactions take place in the stroma of the chloroplast.", type: "swapped_terms", explanation: "The light-dependent reactions happen on the thylakoid membranes; the stroma is where the Calvin cycle happens.", tempting: "Both locations are inside the chloroplast and the stroma is mentioned a lot, so the two are easy to swap.", label: "Swaps the thylakoid and the stroma" },
      5: { sabotaged: "There, carbon dioxide is split by photolysis, which releases oxygen as a by-product.", type: "wrong_mechanism", explanation: "Photolysis splits water, not carbon dioxide. The oxygen released comes from water.", tempting: "Carbon dioxide contains oxygen and is taken in, so it seems a natural source for the oxygen released.", label: "Thinks released oxygen comes from CO₂" },
      9: { sabotaged: "The enzyme RuBisCO fixes oxygen by combining it with ribulose bisphosphate.", type: "swapped_terms", explanation: "In the Calvin cycle RuBisCO fixes carbon dioxide. Fixing oxygen is photorespiration, a wasteful side reaction.", tempting: "RuBisCO really can bind oxygen, so the sentence sounds half-familiar.", label: "Confuses carbon fixation with photorespiration" },
      2: { sabotaged: "The overall reaction uses oxygen and water and releases carbon dioxide.", type: "reversed_causation", explanation: "That is respiration. Photosynthesis takes in carbon dioxide and releases oxygen.", tempting: "Students often mix up the photosynthesis and respiration equations because they are reverses of each other.", label: "Mixes up photosynthesis and respiration equations" },
    },
  },
  {
    id: "water-cycle",
    title: "The water cycle",
    subject: "geography",
    match: /water cycle|hydrolog|evaporat|precipitat|rain|cloud/i,
    sentences: [
      "The Sun's energy drives the water cycle by heating water at the Earth's surface.",
      "During evaporation, liquid water absorbs energy and turns into water vapour.",
      "Transpiration is the loss of water vapour from plant leaves through pores called stomata.",
      "As the water vapour rises, it cools and condenses into tiny droplets that form clouds.",
      "Condensation releases latent heat back into the atmosphere.",
      "When droplets grow heavy enough, they fall as precipitation: rain, snow, sleet or hail.",
      "Some precipitation soaks into the ground by infiltration and becomes groundwater.",
      "Water that cannot soak in flows over the land as surface run-off into rivers.",
      "Most of the Earth's fresh water is stored in ice caps and glaciers.",
      "Groundwater can flow slowly through rocks back to rivers and the sea.",
    ],
    errors: {
      3: { sabotaged: "As the water vapour rises, it warms and condenses into tiny droplets that form clouds.", type: "wrong_mechanism", explanation: "Rising air expands and cools. Cooling is what makes water vapour condense.", tempting: "Warm air rises, so it feels natural that rising air keeps getting warmer.", label: "Thinks rising air warms" },
      8: { sabotaged: "Most of the Earth's fresh water is stored in rivers and lakes.", type: "plausible_but_false_detail", explanation: "About 69% of fresh water is in ice caps and glaciers and about 30% is groundwater. Rivers and lakes hold well under 1%.", tempting: "Rivers and lakes are the fresh water we see and use, so they feel like the main store.", label: "Overestimates rivers and lakes as stores" },
      4: { sabotaged: "Condensation absorbs latent heat from the atmosphere.", type: "reversed_causation", explanation: "Condensation releases latent heat; evaporation is the stage that absorbs it.", tempting: "Evaporation absorbs heat, and students often assume every phase change does the same.", label: "Thinks condensation absorbs heat" },
      6: { sabotaged: "Some precipitation soaks into the ground by percolation and becomes surface run-off.", type: "swapped_terms", explanation: "Water soaking into the ground is infiltration and becomes groundwater, not surface run-off.", tempting: "Infiltration, percolation and run-off are similar-sounding stores and flows.", label: "Confuses infiltration and run-off" },
    },
  },
  {
    id: "ww1-causes",
    title: "Causes of the First World War",
    subject: "history",
    match: /world war (one|1|i)\b|first world war|ww1|wwi\b|1914|franz ferdinand/i,
    sentences: [
      "By 1914 Europe was divided into two alliance systems.",
      "The Triple Entente linked Britain, France and Russia.",
      "The Triple Alliance linked Germany, Austria-Hungary and Italy.",
      "A naval arms race had developed between Britain and Germany after 1906.",
      "Britain launched HMS Dreadnought in 1906, making older battleships outdated.",
      "Tension in the Balkans was high after Austria-Hungary annexed Bosnia in 1908.",
      "On 28 June 1914 Archduke Franz Ferdinand was assassinated in Sarajevo.",
      "The assassin, Gavrilo Princip, was a Bosnian Serb nationalist.",
      "Austria-Hungary declared war on Serbia on 28 July 1914.",
      "Russia mobilised its army to support Serbia.",
      "Germany declared war on Russia and then on France.",
      "Britain declared war on Germany after German troops invaded Belgium.",
    ],
    errors: {
      2: { sabotaged: "The Triple Alliance linked Germany, Austria-Hungary and Russia.", type: "wrong_attribution", explanation: "The third member of the Triple Alliance was Italy. Russia was in the Triple Entente.", tempting: "Russia bordered both Germany and Austria-Hungary, so it seems a natural ally for them.", label: "Puts Russia in the wrong alliance" },
      7: { sabotaged: "The assassin, Gavrilo Princip, was an Austrian anarchist.", type: "wrong_attribution", explanation: "Princip was a Bosnian Serb nationalist linked to the Black Hand.", tempting: "Many famous assassinations of the era were by anarchists.", label: "Misidentifies the assassin's motive" },
      11: { sabotaged: "Britain declared war on Germany after German troops invaded the Netherlands.", type: "plausible_but_false_detail", explanation: "Germany invaded Belgium, whose neutrality Britain had guaranteed in 1839. The Netherlands stayed neutral.", tempting: "Belgium and the Netherlands are neighbours and both were on Germany's western border.", label: "Wrong country invaded" },
      4: { sabotaged: "Germany launched HMS Dreadnought in 1906, making older battleships outdated.", type: "wrong_attribution", explanation: "HMS Dreadnought was a British ship; 'HMS' means His Majesty's Ship.", tempting: "Germany was the challenger in the naval race, so students expect it to have built the famous ship.", label: "Attributes Dreadnought to Germany" },
    },
  },
  {
    id: "respiration",
    title: "Aerobic respiration",
    subject: "biology",
    match: /respiration|glycolysis|krebs|mitochondri|atp/i,
    sentences: [
      "Aerobic respiration releases energy from glucose in the presence of oxygen.",
      "It produces carbon dioxide and water as waste products.",
      "The first stage, glycolysis, takes place in the cytoplasm.",
      "Glycolysis splits one glucose molecule into two molecules of pyruvate.",
      "Glycolysis produces a net gain of two ATP molecules per glucose.",
      "In the presence of oxygen, pyruvate moves into the mitochondria.",
      "The Krebs cycle takes place in the matrix of the mitochondria.",
      "Oxidative phosphorylation takes place on the inner mitochondrial membrane.",
      "Oxygen is the final electron acceptor in the electron transport chain.",
      "Most of the ATP made in aerobic respiration comes from oxidative phosphorylation.",
      "Without oxygen, human muscle cells carry out anaerobic respiration and produce lactate.",
      "Anaerobic respiration releases much less energy per glucose molecule than aerobic respiration.",
    ],
    errors: {
      2: { sabotaged: "The first stage, glycolysis, takes place in the mitochondria.", type: "swapped_terms", explanation: "Glycolysis happens in the cytoplasm. Only the later stages happen in the mitochondria.", tempting: "Mitochondria are taught as 'where respiration happens', so every stage gets placed there.", label: "Puts glycolysis in the mitochondria" },
      4: { sabotaged: "Glycolysis produces a net gain of four ATP molecules per glucose.", type: "wrong_quantity_or_value", explanation: "Glycolysis makes four ATP but uses two, so the net gain is two.", tempting: "Four is the gross number of ATP made, which also appears in textbooks.", label: "Confuses gross and net ATP from glycolysis" },
      8: { sabotaged: "Carbon dioxide is the final electron acceptor in the electron transport chain.", type: "swapped_terms", explanation: "Oxygen accepts the electrons at the end of the chain and forms water. Carbon dioxide is released earlier, in the link reaction and Krebs cycle.", tempting: "Carbon dioxide is the other gas in respiration, so the two get swapped.", label: "Thinks CO₂ accepts the electrons" },
      10: { sabotaged: "Without oxygen, human muscle cells carry out anaerobic respiration and produce ethanol.", type: "plausible_but_false_detail", explanation: "Human muscle makes lactate. Ethanol and carbon dioxide are the products in yeast and plants.", tempting: "Anaerobic respiration in yeast (fermentation) is taught alongside it.", label: "Confuses animal and yeast anaerobic products" },
    },
  },
  {
    id: "newtons-laws",
    title: "Newton's laws of motion",
    subject: "physics",
    match: /newton|force|motion|inertia|accelerat/i,
    sentences: [
      "Newton's first law states that an object stays at rest or moves at a constant velocity unless a resultant force acts on it.",
      "This tendency to resist changes in motion is called inertia.",
      "Newton's second law states that the resultant force equals mass multiplied by acceleration.",
      "Force is measured in newtons, mass in kilograms and acceleration in metres per second squared.",
      "For a fixed resultant force, doubling the mass halves the acceleration.",
      "Acceleration is always in the same direction as the resultant force.",
      "Newton's third law states that when two objects interact, they exert equal and opposite forces on each other.",
      "The two forces in a third-law pair act on different objects.",
      "Weight is the force of gravity on an object and is measured in newtons.",
      "On Earth, the gravitational field strength is about 9.8 newtons per kilogram.",
      "An object moving in a circle at constant speed is accelerating because its direction keeps changing.",
      "In a vacuum, a feather and a hammer dropped together fall with the same acceleration.",
    ],
    errors: {
      5: { sabotaged: "Acceleration is always in the same direction as the velocity.", type: "false_generalisation", explanation: "Acceleration points along the resultant force. A braking car accelerates backwards while still moving forwards.", tempting: "In everyday speeding up, acceleration and motion point the same way, so it feels like a rule.", label: "Thinks acceleration follows the velocity" },
      7: { sabotaged: "The two forces in a third-law pair act on the same object.", type: "swapped_terms", explanation: "Third-law pairs always act on different objects; that is why they don't cancel out.", tempting: "Balanced forces on one object are also equal and opposite, so the two ideas blur together.", label: "Confuses third-law pairs with balanced forces" },
      4: { sabotaged: "For a fixed resultant force, doubling the mass doubles the acceleration.", type: "reversed_causation", explanation: "a = F/m, so for the same force a larger mass gives a smaller acceleration.", tempting: "F = ma looks like everything goes up together.", label: "Thinks acceleration rises with mass" },
      10: { sabotaged: "An object moving in a circle at constant speed is not accelerating because its speed never changes.", type: "wrong_mechanism", explanation: "Velocity includes direction. Changing direction is a change in velocity, so the object is accelerating towards the centre.", tempting: "In everyday language, accelerating means speeding up.", label: "Equates acceleration with speeding up" },
    },
  },
  {
    id: "supply-demand",
    title: "Supply and demand",
    subject: "economics",
    match: /supply|demand|market|equilibrium|price elastic|econom/i,
    sentences: [
      "In a competitive market, price is set by the interaction of supply and demand.",
      "The law of demand states that as price rises, the quantity demanded falls, other things being equal.",
      "The law of supply states that as price rises, the quantity supplied rises.",
      "The equilibrium price is the price at which quantity demanded equals quantity supplied.",
      "If the price is above equilibrium, there is excess supply, which pushes the price down.",
      "If the price is below equilibrium, there is excess demand, which pushes the price up.",
      "A change in the good's own price causes a movement along the demand curve, not a shift.",
      "An increase in consumer income shifts the demand curve for a normal good to the right.",
      "For an inferior good, demand falls as income rises.",
      "A rise in production costs shifts the supply curve to the left.",
      "Demand is price inelastic when a change in price causes a proportionately smaller change in quantity demanded.",
      "Goods with few close substitutes tend to have price inelastic demand.",
    ],
    errors: {
      6: { sabotaged: "A change in the good's own price causes a shift of the demand curve, not a movement along it.", type: "swapped_terms", explanation: "Own-price changes move you along the curve. Shifts come from other factors such as income or tastes.", tempting: "Price is on the diagram, so changing it feels like it should move the whole curve.", label: "Confuses shifts and movements along" },
      4: { sabotaged: "If the price is above equilibrium, there is excess demand, which pushes the price up.", type: "reversed_causation", explanation: "Above equilibrium, more is supplied than demanded: excess supply, which pushes the price down.", tempting: "A high price sounds like a sign of high demand.", label: "Reverses surplus and shortage" },
      9: { sabotaged: "A rise in production costs shifts the supply curve to the right.", type: "reversed_causation", explanation: "Higher costs reduce supply at every price, shifting the curve left.", tempting: "'Rise' and 'right' both feel like 'more', so the direction gets flipped.", label: "Shifts supply the wrong way" },
      8: { sabotaged: "For an inferior good, demand rises as income rises.", type: "wrong_mechanism", explanation: "That describes a normal good. Demand for an inferior good falls as income rises.", tempting: "Most goods are normal goods, so it is easy to assume they all behave that way.", label: "Confuses inferior and normal goods" },
    },
  },
  {
    id: "heart",
    title: "The heart and circulation",
    subject: "biology",
    match: /heart|circulat|blood|arter|vein|ventric|atri/i,
    sentences: [
      "The human heart has four chambers: two atria and two ventricles.",
      "The right side of the heart pumps deoxygenated blood to the lungs.",
      "The left side of the heart pumps oxygenated blood to the rest of the body.",
      "This is a double circulatory system, because blood passes through the heart twice in each complete circuit.",
      "The left ventricle has a thicker muscular wall than the right ventricle.",
      "Arteries carry blood away from the heart at high pressure.",
      "Veins carry blood back to the heart and contain valves that prevent backflow.",
      "The pulmonary artery carries deoxygenated blood from the heart to the lungs.",
      "The pulmonary vein carries oxygenated blood from the lungs to the left atrium.",
      "Capillaries have walls only one cell thick, which allows substances to diffuse in and out.",
      "The heartbeat is started by a group of cells called the sinoatrial node, which acts as a pacemaker.",
      "The coronary arteries supply the heart muscle itself with oxygenated blood.",
    ],
    errors: {
      7: { sabotaged: "The pulmonary artery carries oxygenated blood from the heart to the lungs.", type: "false_generalisation", explanation: "The pulmonary artery carries deoxygenated blood. Arteries are defined by carrying blood away from the heart, not by oxygen level.", tempting: "Students learn 'arteries carry oxygenated blood' as a rule, and this is the exception.", label: "Thinks all arteries carry oxygenated blood" },
      4: { sabotaged: "The right ventricle has a thicker muscular wall than the left ventricle.", type: "swapped_terms", explanation: "The left ventricle pumps blood round the whole body, so it needs the thicker wall.", tempting: "Left and right on heart diagrams are mirrored, which makes sides easy to swap.", label: "Swaps left and right ventricle" },
      3: { sabotaged: "This is a double circulatory system, because blood passes through the heart once in each complete circuit.", type: "wrong_quantity_or_value", explanation: "'Double' means blood goes through the heart twice per circuit: once to the lungs and once to the body.", tempting: "One heartbeat pushes blood round, so 'once' sounds reasonable.", label: "Misunderstands double circulation" },
      6: { sabotaged: "Veins carry blood back to the heart at high pressure and have no valves.", type: "wrong_mechanism", explanation: "Blood in veins is at low pressure, which is exactly why veins need valves to stop backflow.", tempting: "Arteries and veins are often learned as a pair of opposites, so details get crossed.", label: "Muddles vein pressure and valves" },
    },
  },
  {
    id: "plate-tectonics",
    title: "Plate tectonics",
    subject: "geography",
    match: /tectonic|plate|earthquake|volcan|subduct|continental drift/i,
    sentences: [
      "The Earth's lithosphere is broken into large sections called tectonic plates.",
      "The plates move slowly, typically a few centimetres per year.",
      "Convection currents in the mantle are one of the forces that help to move the plates.",
      "At constructive boundaries, plates move apart and new crust is formed.",
      "The Mid-Atlantic Ridge is an example of a constructive boundary.",
      "At destructive boundaries, denser oceanic crust is subducted beneath less dense continental crust.",
      "Subduction can produce deep ocean trenches and explosive volcanoes.",
      "At conservative boundaries, plates slide past each other and crust is neither created nor destroyed.",
      "The San Andreas Fault in California is an example of a conservative boundary.",
      "When two continental plates collide, neither is easily subducted, so fold mountains form.",
      "The Himalayas formed where the Indian Plate collided with the Eurasian Plate.",
      "Most earthquakes and volcanoes occur near plate boundaries.",
    ],
    errors: {
      5: { sabotaged: "At destructive boundaries, less dense oceanic crust is subducted beneath denser continental crust.", type: "reversed_causation", explanation: "Oceanic crust is denser than continental crust, and that is why it is the one that sinks.", tempting: "The sentence keeps the right outcome, so the reversed reason is easy to miss.", label: "Reverses crust densities" },
      8: { sabotaged: "The San Andreas Fault in California is an example of a constructive boundary.", type: "wrong_attribution", explanation: "At the San Andreas Fault the Pacific and North American plates slide past each other, which is a conservative boundary.", tempting: "It is the most famous boundary, so it gets attached to whichever type is being discussed.", label: "Mislabels the San Andreas Fault" },
      1: { sabotaged: "The plates move slowly, typically a few metres per year.", type: "wrong_quantity_or_value", explanation: "Plates move a few centimetres a year, about as fast as fingernails grow.", tempting: "'Slowly' feels compatible with metres when the plates are thousands of kilometres across.", label: "Overestimates plate speed" },
      10: { sabotaged: "The Himalayas formed where the Indian Plate collided with the Pacific Plate.", type: "wrong_attribution", explanation: "The Indian Plate collided with the Eurasian Plate.", tempting: "The Pacific Plate is the best-known plate, so it is a natural guess.", label: "Wrong plate for the Himalayas" },
    },
  },
];

export const LIBRARY: LibraryEntry[] = [...CORE, ...EXTRA];

/** The library entry that best matches a topic, if any. */
export function findLibraryEntry(topic: string): LibraryEntry | null {
  const t = topic.toLowerCase().trim();
  const byTitle = LIBRARY.find((e) => t.includes(e.title.toLowerCase()) || (t.length >= 5 && e.title.toLowerCase().includes(t)));
  return byTitle ?? LIBRARY.find((e) => e.match.test(topic)) ?? null;
}
