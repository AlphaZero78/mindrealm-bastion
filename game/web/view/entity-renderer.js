import { WholeEntityRenderer } from './whole-entity-renderer.js';
export class EntityRenderer extends WholeEntityRenderer {
  constructor(options = {}) { super({ ...options, preload: options.preload ?? 'core' }); }
}
export default EntityRenderer;
