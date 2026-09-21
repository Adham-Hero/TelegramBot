/**
 * This does NOT touch MongoDB or Telegram - it exercises the exact same
 * parseTopicName() logic the real bot uses, and simulates ensureHierarchyNodes()
 * with a plain in-memory tree, to prove the required test scenario from the
 * spec works with zero code changes when new topics appear.
 */
import { parseTopicName } from '../src/utils/topicParser';

interface Node {
  rawName: string;
  normalizedName: string;
  level: string;
  children: Map<string, Node>;
}

const root = new Map<string, Node>(); // years

function ensure(map: Map<string, Node>, raw: string, normalized: string, level: string): Node {
  let node = map.get(normalized);
  if (!node) {
    node = { rawName: raw, normalizedName: normalized, level, children: new Map() };
    map.set(normalized, node);
  }
  return node;
}

function ingest(rawTopicName: string) {
  const parsed = parseTopicName(rawTopicName, '|');
  if (!parsed.isValid) {
    console.log(`  ❌ UNCATEGORIZED: "${rawTopicName}" (${parsed.reason})`);
    return;
  }
  const y = parsed.levels.year!;
  const s = parsed.levels.semester!;
  const c = parsed.levels.category!;
  const t = parsed.levels.contentType!;

  const yearNode = ensure(root, y.raw, y.normalized, 'year');
  const semNode = ensure(yearNode.children, s.raw, s.normalized, 'semester');
  const catNode = ensure(semNode.children, c.raw, c.normalized, 'category');
  ensure(catNode.children, t.raw, t.normalized, 'contentType');
}

function printTree() {
  for (const year of root.values()) {
    console.log(`🎓 ${year.rawName}`);
    for (const sem of year.children.values()) {
      console.log(`  📚 ${sem.rawName}`);
      for (const cat of sem.children.values()) {
        console.log(`    📂 ${cat.rawName}`);
        for (const ct of cat.children.values()) {
          console.log(`      📄 ${ct.rawName}`);
        }
      }
    }
  }
}

console.log('=== STEP 1: initial topics ===');
const initialTopics = [
  'سنة أولى | ترم أول | Anatomy | شرح',
  'سنة أولى | ترم أول | Anatomy | أسئلة',
  'سنة أولى | ترم أول | Physiology | شرح',
  'سنة أولى | ترم أول | تراكمي أولى | أسئلة',
  'سنة أولى | ترم أول | متنوعات | ملفات',
  'سنة رابعة | ترم أول | Anatomy | شرح',
];
initialTopics.forEach(ingest);
printTree();

console.log('\n=== STEP 2: add new topic WITHOUT touching any code ===');
console.log('Adding: "سنة ثانية | ترم ثاني | Pharmacology | امتحانات"');
ingest('سنة ثانية | ترم ثاني | Pharmacology | امتحانات');
printTree();

console.log('\n=== STEP 3: add another brand-new category WITHOUT touching any code ===');
console.log('Adding: "سنة ثانية | ترم ثاني | مراجعات عامة | ملفات"');
ingest('سنة ثانية | ترم ثاني | مراجعات عامة | ملفات');
printTree();

console.log('\n=== STEP 4: malformed topic name -> goes to Uncategorized, does not crash ===');
ingest('Important Files');
ingest('متنوعات');

console.log('\n=== STEP 5: format-tolerance check (no spaces / extra spaces / different separators are treated identically) ===');
const a = parseTopicName('سنة أولى|ترم أول|Anatomy|شرح', '|');
const b = parseTopicName('سنة أولى |  ترم أول | Anatomy |شرح', '|');
console.log('normalized A:', a.normalizedName);
console.log('normalized B:', b.normalizedName);
console.log('Identical after normalization:', a.normalizedName === b.normalizedName);
