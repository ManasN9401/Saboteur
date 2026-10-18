// How each kind of planted error is named in the interface.
import type { ErrorType } from "./schemas";

/** Short names, for tags and table rows. */
export const ERROR_TYPE_LABEL: Record<ErrorType, string> = {
  reversed_causation: "Reversed cause",
  wrong_quantity_or_value: "Wrong value",
  swapped_terms: "Swapped terms",
  false_generalisation: "False generalisation",
  missing_exception: "Missing exception",
  wrong_mechanism: "Wrong mechanism",
  wrong_sequence: "Wrong order",
  wrong_attribution: "Wrong attribution",
  plausible_but_false_detail: "Plausible but false",
};

/** One of them, in a sentence: "a swapped term has got past you". */
export const ERROR_TYPE_PHRASE: Record<ErrorType, string> = {
  reversed_causation: "a reversed cause and effect",
  wrong_quantity_or_value: "a wrong number",
  swapped_terms: "a swapped term",
  false_generalisation: "an overgeneralisation",
  missing_exception: "a missing exception",
  wrong_mechanism: "a wrong mechanism",
  wrong_sequence: "a wrong order of events",
  wrong_attribution: "a wrong attribution",
  plausible_but_false_detail: "a plausible but false detail",
};
