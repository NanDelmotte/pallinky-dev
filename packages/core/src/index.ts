/** * Path: packages/core/src/index.ts 
 * Description: Entry point for shared logic. 
 * Only exports universal logic to prevent Web build crashes from Mobile dependencies.
 */

// Universal Exports (Safe for Web and Mobile)
export * from './supabase';

//Mobile-Only Exports (Commented out to allow Web build to pass)
export * from './session'; 
export * from './handle-link';
export * from './auth';