const fs = require('fs');
const lines = fs.readFileSync('src/components/VendorDashboard.tsx', 'utf8').split('\n');
let depth = 0;
let queueStart = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('{activeTab === "queue" && (')) queueStart = i;
  if (queueStart !== -1 && i >= queueStart) {
    const divOpen = (lines[i].match(/<div/g) || []).length;
    const divClose = (lines[i].match(/<\/div>/g) || []).length;
    depth += divOpen - divClose;
    if (lines[i].includes(')}')) {
        console.log(`Line ${i}: depth=${depth}, code=${lines[i].trim()}`);
    }
  }
}
console.log(`Final depth: ${depth}`);
