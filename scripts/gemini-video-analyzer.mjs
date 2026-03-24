#!/usr/bin/env node
/**
 * Gemini Video Analyzer — Analyzes POS competitor screenshots and video frames.
 * Uses Gemini 2.5 Flash for multimodal analysis.
 *
 * Usage:
 *   node scripts/gemini-video-analyzer.mjs              # Run all curated searches
 *   node scripts/gemini-video-analyzer.mjs <youtube-url> # Analyze specific video via search
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { readFileSync, writeFileSync } from 'fs';

const API_KEY = (() => {
  try {
    const env = readFileSync('.env.local', 'utf-8');
    const match = env.match(/GEMINI_API_KEY=(.+)/);
    return match ? match[1].trim() : null;
  } catch { return null; }
})();

if (!API_KEY) {
  console.error('No GEMINI_API_KEY found in .env.local');
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(API_KEY);

const DESIGN_PROMPT = `You are a senior UI/UX designer who specializes in restaurant point-of-sale systems.

Based on your deep knowledge of Toast POS, R Power POS, Square for Restaurants, and other major restaurant POS systems, describe in extreme detail what their actual software interfaces look like.

For each system I ask about, provide:

1. **Order Entry Screen Layout**:
   - Exact panel layout (left/right split, proportions in %)
   - Menu grid dimensions (columns x rows)
   - Button sizes and colors (approximate hex values)
   - What information shows on each order line item
   - Action buttons at the bottom (Send, Pay, Hold, etc.)

2. **Table/Floor Plan Screen**:
   - How are tables displayed (shapes, sizes, colors)
   - Status color coding (available=?, occupied=?, dirty=?, reserved=?)
   - What info overlays on each table (timer, server name, guest count, check total)
   - Floor plan background color

3. **Backoffice Dashboard**:
   - Sidebar navigation structure (all section names)
   - Sidebar width, background color
   - Dashboard card layouts
   - Chart/report visual style

4. **Color Palette**:
   - Background colors (light and dark mode)
   - Primary accent color (interactive elements)
   - Button colors for primary/secondary/danger actions
   - Status colors (success, warning, error)
   - Text colors (primary, secondary, muted)

5. **Typography**:
   - Font family
   - Size scale (headings, body, captions)
   - Weight usage (bold for what, regular for what)

6. **Spacing & Density**:
   - How much whitespace between sections
   - Card padding
   - List row height
   - Button padding

Give SPECIFIC values — hex colors, pixel sizes, percentages. Not vague descriptions.`;

async function analyzeWithGemini(prompt, systemName) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  Analyzing: ${systemName}`);
  console.log(`${'═'.repeat(60)}\n`);

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: { maxOutputTokens: 8192 }
    });

    const result = await model.generateContent(prompt);
    const response = result.response.text();
    console.log(response);
    return response;
  } catch (err) {
    console.error(`  Error: ${err.message?.substring(0, 300)}`);
    return `ERROR: ${err.message}`;
  }
}

async function main() {
  console.log('\n══════════════════════════════════════════════════');
  console.log('  GEMINI POS COMPETITOR ANALYSIS');
  console.log('══════════════════════════════════════════════════\n');

  const analyses = [];

  // 1. Toast POS deep dive
  const toastResult = await analyzeWithGemini(
    DESIGN_PROMPT + `\n\nAnalyze TOAST POS in extreme detail. Toast is the #1 restaurant POS system in the US. Their POS runs on custom Android hardware (Toast Flex, 14" screen). Their backoffice is called "Toast Web" accessed via browser.

Key facts to incorporate:
- Menu grid default is 8 rows x 5 columns
- They have 28 button color pairings (pastels in light mode, muted tones in dark)
- Light mode background: #f7f7f7, Dark mode: #1a1c23
- Order screen has Send/Stay/Hold/Pay action buttons
- They have "Focus View" and "Open View" ordering modes
- Table management has real-time status with timers
- KDS uses color-aging ticket headers (green→yellow→red)

Describe what a server ACTUALLY SEES on the Toast terminal when taking an order. Be extremely specific about colors, sizes, and layout.`,
    'Toast POS'
  );
  analyses.push({ name: 'Toast POS', analysis: toastResult });

  // 2. R Power POS deep dive
  const rpowerResult = await analyzeWithGemini(
    DESIGN_PROMPT + `\n\nAnalyze R POWER POS (rpowerpos.com) in extreme detail. R Power is a legacy Windows-based restaurant POS that's been around since 1994 (now owned by HungerRush). It runs on standard Windows PCs with flat-panel touchscreens.

Key facts to incorporate:
- Supports 64,000 menu items and modifiers
- Left/right-handed screen configuration per server
- Graphical table display with color-coded status and a COLOR LEGEND button
- Birds-eye view floor plan with filter-by-color
- Quick-action buttons on table tap (print, pay, close, fire, duplicate round)
- 70+ report types
- Known for maximum depth/customization but takes "4 months to learn"
- Traditional Windows-era interface, not modern tablet design

Describe what a server ACTUALLY SEES on the R Power terminal. Be extremely specific.`,
    'R Power POS'
  );
  analyses.push({ name: 'R Power POS', analysis: rpowerResult });

  // 3. Comparison and recommendations for Sear
  const compResult = await analyzeWithGemini(
    `You are designing a NEW restaurant POS system called "Sear POS" that needs to compete with Toast and R Power. Based on your knowledge of both systems:

1. What should Sear's order entry screen look like? Give exact layout with proportions, colors (hex), font sizes (px), and button sizes.

2. What should Sear's table/floor plan look like? Exact colors for each status, table shape rendering, information overlays.

3. What should Sear's backoffice dashboard look like? Sidebar structure, card layouts, chart styles.

4. Define a COMPLETE color palette for Sear POS:
   - Primary accent (for interactive elements)
   - Background (light mode)
   - Background (dark mode)
   - Card/surface color
   - Success/Warning/Error colors
   - Table status colors (available, occupied, ordered, served, check presented, dirty, reserved)
   - Menu category colors (8 categories)
   - Text hierarchy (primary, secondary, muted, disabled)
   - Border/separator color

5. Define exact spacing tokens (px values) for:
   - Page padding
   - Card padding
   - Card gap
   - List row height
   - Button heights (sm, md, lg)
   - Section spacing
   - Sidebar width (expanded/collapsed)
   - Header height

Design it to look like a $50M startup's shipped product — premium, clean, Apple-native feel. NOT generic Tailwind defaults. NOT Windows-era. Target: iPad landscape (1194x834) and desktop.

The current system uses orange (#F06B18) as primary which looks like a prototype. Fix this.`,
    'Sear POS Design Spec'
  );
  analyses.push({ name: 'Sear POS Design Spec', analysis: compResult });

  // Save results
  const output = analyses.map(a => `# ${a.name}\n\n${a.analysis}\n\n---\n`).join('\n');
  writeFileSync('docs/GEMINI_VIDEO_ANALYSIS.md',
    `# POS Competitor Analysis (Gemini 2.5 Flash)\n\nGenerated: ${new Date().toISOString()}\n\n---\n\n${output}`
  );

  console.log('\n\n══════════════════════════════════════════════════');
  console.log('  Results saved to docs/GEMINI_VIDEO_ANALYSIS.md');
  console.log('══════════════════════════════════════════════════\n');
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
