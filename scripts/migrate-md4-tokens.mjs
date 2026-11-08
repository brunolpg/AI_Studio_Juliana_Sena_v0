import fs from 'fs';
import path from 'path';

const TARGET_DIRS = ['app', 'components'];

// Mapeamento de Regex -> Token Semântico MD4 (globals.css)
const REPLACEMENTS = [
  // 1. Superfícies de Fundo (remove dark: legado quando aplicável)
  {
    regex: /\bbg-white(\s+dark:bg-(slate|gray|zinc)-(800|900|950))?\b/g,
    replace: 'bg-surface-container-lowest',
  },
  {
    regex: /\bbg-(slate|gray|zinc)-50(\s+dark:bg-(slate|gray|zinc)-(800|900|950))?\b/g,
    replace: 'bg-surface',
  },
  {
    regex: /\bbg-(slate|gray|zinc)-100(\s+dark:bg-(slate|gray|zinc)-(700|800|900))?\b/g,
    replace: 'bg-surface-container',
  },
  {
    regex: /\bbg-(slate|gray|zinc)-200(\s+dark:bg-(slate|gray|zinc)-(600|700|800))?\b/g,
    replace: 'bg-surface-container-high',
  },

  // 2. Cores Primárias e Containers (Teal / Emerald Clínico)
  {
    regex: /\bbg-(teal|emerald)-(600|700)(\s+dark:bg-(teal|emerald)-(500|600))?\b/g,
    replace: 'bg-primary',
  },
  {
    regex: /\bhover:bg-(teal|emerald)-(700|800)\b/g,
    replace: 'hover:opacity-90',
  },
  {
    regex: /\bbg-(teal|emerald)-(50|100)(\s+dark:bg-(teal|emerald)-(900|950)(\/\d+)?)?\b/g,
    replace: 'bg-primary-container',
  },
  {
    regex: /\btext-(teal|emerald)-(700|800|900)(\s+dark:text-(teal|emerald)-(100|200|300))?\b/g,
    replace: 'text-on-primary-container',
  },
  {
    regex: /\btext-(teal|emerald)-(500|600)(\s+dark:text-(teal|emerald)-(400))?\b/g,
    replace: 'text-primary',
  },

  // 3. Tipografia e Contraste (On-Surface)
  {
    regex: /\btext-(slate|gray|zinc)-(800|900|950)(\s+dark:text-(white|(slate|gray|zinc)-(50|100|200)))?\b/g,
    replace: 'text-on-surface',
  },

  // 4. Bordas e Divisores (Outline)
  {
    regex: /\bborder-(slate|gray|zinc)-(100|200)(\s+dark:border-(slate|gray|zinc)-(700|800))?\b/g,
    replace: 'border-outline-variant',
  },
  {
    regex: /\bborder-(slate|gray|zinc)-300(\s+dark:border-(slate|gray|zinc)-(600|700))?\b/g,
    replace: 'border-outline',
  },
];

function walkAndReplace(dirPath) {
  if (!fs.existsSync(dirPath)) return;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      walkAndReplace(fullPath);
    } else if (entry.isFile() && /\.(tsx|ts|jsx)$/.test(entry.name)) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let original = content;

      for (const { regex, replace } of REPLACEMENTS) {
        content = content.replace(regex, replace);
      }

      if (content !== original) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(`✔ Atualizado: ${fullPath}`);
      }
    }
  }
}

console.log('Iniciando migração para tokens MD4...');
TARGET_DIRS.forEach(walkAndReplace);
console.log('Concluído! Use "git diff" para revisar as alterações.');
