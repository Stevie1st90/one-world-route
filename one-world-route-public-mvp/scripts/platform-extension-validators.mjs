import './platform-extension-validators/cruise.mjs';
import './platform-extension-validators/road-trip.mjs';
import './platform-extension-validators/border.mjs';
import './platform-extension-validators/cruise-call.mjs';
import './platform-extension-validators/port.mjs';
import './platform-extension-validators/rail.mjs';

export {
  getPlatformExtension,
  registerPlatformExtensionValidator,
  listPlatformExtensionValidators,
  validatePlatformExtensions,
  platformExtensionCompatibility
} from './platform-extension-validators/registry.mjs';
