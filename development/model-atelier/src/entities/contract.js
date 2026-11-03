export function defineEntity(definition) {
  const { id, name, kind, role, locomotion, variants, build, clips, concept, mechanism } = definition;
  if (!id || !name || !['monster', 'building'].includes(kind)) throw new Error(`Invalid entity ${id}`);
  if (!Array.isArray(variants) || !variants.length || !variants.every(variant => typeof variant === 'string')) throw new Error(`${id}: invalid variants`);
  if (typeof build !== 'function' || typeof clips !== 'function') throw new Error(`${id}: build and clips are required`);
  return Object.freeze({ id, name, kind, role, locomotion, variants: Object.freeze([...variants]), build, clips, concept, mechanism });
}
