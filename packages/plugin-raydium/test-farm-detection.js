// Quick test for farm detection
import { findFarmByLpMint } from './dist/index.js';

const LP_MINT = '83WevmL2JzaEvDmuJUFMxcFNnHqP4xonfvAzKmsPWjwu';

console.log('Testing farm detection...');
console.log('Looking for LP mint:', LP_MINT);

findFarmByLpMint(LP_MINT)
  .then(farm => {
    if (farm) {
      console.log('✅ Farm found!');
      console.log('Farm ID:', farm.id);
      console.log('Symbol:', farm.symbol);
      console.log('Version:', farm.version);
      console.log('Program ID:', farm.programId);
    } else {
      console.log('❌ No farm found');
    }
  })
  .catch(err => {
    console.error('Error:', err);
  });