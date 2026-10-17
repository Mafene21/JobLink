import { copyFile, mkdir } from 'node:fs/promises';

const destination = new URL('../public/assets/js/vendor/', import.meta.url);
await mkdir(destination, { recursive: true });
await copyFile(new URL('../node_modules/dompurify/dist/purify.es.mjs', import.meta.url), new URL('dompurify.js', destination));
await copyFile(new URL('../node_modules/dompurify/LICENSE', import.meta.url), new URL('DOMPurify-LICENSE.txt', destination));
await copyFile(new URL('../node_modules/@supabase/supabase-js/dist/umd/supabase.js', import.meta.url), new URL('supabase.js', destination));
await copyFile(new URL('../node_modules/@supabase/supabase-js/LICENSE', import.meta.url), new URL('Supabase-LICENSE.txt', destination));
console.log('Updated local DOMPurify and Supabase modules and their licenses.');
