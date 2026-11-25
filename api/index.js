// Load the existing TypeScript server modules in the Node.js function runtime.
import 'tsx/esm';

const { createApiApp } = await import('../server/app.ts');

export default createApiApp();
