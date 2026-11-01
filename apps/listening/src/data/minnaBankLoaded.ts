/**
 * 將 minnaNoNihongo.json 載入並初始化題庫。
 * Vite 會在建置時將 JSON 內嵌，無需額外 fetch。
 */

import minnaData from "./minnaNoNihongo.json";
import {
  initializeMinnaBank,
  loadMinnaNoNihongoBank,
  type MinnaNoNihongoEntry,
} from "./minnaBank";

const entries = minnaData as unknown as MinnaNoNihongoEntry[];
const words = loadMinnaNoNihongoBank(entries);

initializeMinnaBank(words);

export { words as MINNA_WORDS };
export { initializeMinnaBank };
export { MINNA_LESSONS, LESSON_COUNTS, WORDS_BY_LESSON, WORD_MAP, REMOVED_ENTRIES } from "./minnaBank";
export { ALL_LESSONS } from "../utils/categories";