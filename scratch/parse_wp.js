import fs from 'fs';

const content = fs.readFileSync('C:/Users/barns/.gemini/antigravity/brain/2a725b13-f209-45fc-a29c-90c02849b89f/.system_generated/steps/106/content.md', 'utf8');

console.log('=== IMAGES IN WP CONTENT ===');
const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
let match;
while ((match = imgRegex.exec(content)) !== null) {
  const full = match[0];
  const src = match[1];
  if (src.includes('wp.com') || src.includes('wordpress') || src.includes('files')) {
    console.log(src);
  }
}

console.log('\n=== HEADINGS AND SECTIONS ===');
const hRegex = /<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi;
while ((match = hRegex.exec(content)) !== null) {
  console.log(match[1].replace(/<[^>]+>/g, '').trim());
}

console.log('\n=== PARAGRAPH SAMPLES ===');
const pRegex = /<p[^>]*>(.*?)<\/p>/gi;
while ((match = pRegex.exec(content)) !== null) {
  const text = match[1].replace(/<[^>]+>/g, '').trim();
  if (text.length > 20 && (text.includes('pallet') || text.includes('furniture') || text.includes('Nigeria') || text.includes('craft') || text.includes('Lagos'))) {
    console.log('•', text);
  }
}
