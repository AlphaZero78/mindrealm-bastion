const ALPHABET='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
export const RUN_SEED_LENGTH=16;

// Only the new-run form consumes ambient randomness. Gameplay continues to use
// the saved seed and its existing deterministic streams.
export function createRunSeed(randomValues=values=>globalThis.crypto.getRandomValues(values)){
 const values=new Uint8Array(32),limit=256-256%ALPHABET.length;
 let seed;
 do{
  seed='';
  while(seed.length<RUN_SEED_LENGTH){
   randomValues(values);
   for(const value of values){
    if(value>=limit)continue; // Reject the short final bucket; each character is equally likely.
    seed+=ALPHABET[value%ALPHABET.length];
    if(seed.length===RUN_SEED_LENGTH)break;
   }
  }
 }while(!/[A-Za-z]/.test(seed)||!/[0-9]/.test(seed));
 return seed;
}
