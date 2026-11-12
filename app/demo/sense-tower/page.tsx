import fs from 'node:fs';
import path from 'node:path';

export const dynamic = 'force-static';

function readLabFile(name: string) {
  return fs.readFileSync(
    path.join(process.cwd(), 'public', 'sense-passport-lab', name),
    'utf8'
  );
}

export default function SenseTowerLabPage() {
  const baseHtml = readLabFile('index.html');
  const css = readLabFile('styles.css');
  const js = readLabFile('app.js');

  const srcDoc = baseHtml
    .replace(
      '<link rel="stylesheet" href="./styles.css" />',
      `<style>${css}</style>`
    )
    .replace(
      '<script src="./app.js"></script>',
      `<script>${js.replaceAll('</script>', '<\\/script>')}</script>`
    );

  return (
    <iframe
      title="AWS SENSE Tower V2 Lab"
      srcDoc={srcDoc}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2147483647,
        width: '100vw',
        height: '100vh',
        border: 0,
        background: '#0b0f14',
      }}
    />
  );
}
