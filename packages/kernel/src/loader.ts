/**
 * Kernel loader — provides runtime access to the loaded company kernel.
 * In production, the kernel config is loaded at startup and validated.
 */

import type { CompanyKernel } from './types.js';

let _loadedKernel: CompanyKernel | null = null;

export function loadKernel(kernel: CompanyKernel): void {
  validateKernel(kernel);
  _loadedKernel = kernel;
}

export function getKernel(): CompanyKernel {
  if (!_loadedKernel) {
    throw new Error(
      'Company kernel has not been loaded. Call loadKernel() during application bootstrap.'
    );
  }
  return _loadedKernel;
}

export function validateKernel(kernel: CompanyKernel): void {
  if (!kernel.identity.businessId) throw new Error('Kernel: identity.businessId is required');
  if (!kernel.identity.legalName) throw new Error('Kernel: identity.legalName is required');
  if (!kernel.identity.owner) throw new Error('Kernel: identity.owner is required');
  if (!kernel.identity.timezone) throw new Error('Kernel: identity.timezone is required');
  if (!kernel.identity.website) throw new Error('Kernel: identity.website is required');

  // Confirm no inline secrets
  if (kernel.identity.ein && 'value' in kernel.identity.ein) {
    throw new Error('Kernel: EIN value must not be stored inline. Use envRef only.');
  }
}

export function isCapabilityEnabled(
  _kernel: CompanyKernel,
  _capabilityId: string
): boolean {
  // TODO: Implement by loading the capability manifest and checking the enabled flag.
  // Do not call this function until implemented — it is not yet wired to the manifest.
  throw new Error(
    'isCapabilityEnabled is not yet implemented. Load the capability manifest and check the enabled field directly.'
  );
}

export function getApprovalLevel(
  kernel: CompanyKernel,
  level: 'A' | 'B' | 'C' | 'D'
) {
  const map = {
    A: kernel.approvalThresholds.levelA,
    B: kernel.approvalThresholds.levelB,
    C: kernel.approvalThresholds.levelC,
    D: kernel.approvalThresholds.levelD,
  };
  return map[level];
}
