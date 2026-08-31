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
  kernel: CompanyKernel,
  capabilityId: string
): boolean {
  // Capabilities are resolved from the manifest, not the kernel directly.
  // This helper is provided for consistent API.
  void kernel;
  void capabilityId;
  return true; // Delegate to capability manifest in production
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
