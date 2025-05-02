/**
 * Feature flag configuration for the application
 * Controls which features are enabled/disabled
 */

export interface FeatureFlags {
  enableGeneralPractitioner: boolean;
  enableSchoolLecture: boolean;
  enableRaghav: boolean;
}

// Default feature flags configuration
// In a production environment, this would typically be loaded from
// environment variables, a configuration service, or user settings
const defaultFeatureFlags: FeatureFlags = {
  enableGeneralPractitioner: false, // Disabled as requested
  enableSchoolLecture: true,        // Enabled as requested
  enableRaghav: false,              // Disabled as requested
};

/**
 * Get the current feature flags configuration
 * This could be extended to load from localStorage, API, etc.
 */
export function getFeatureFlags(): FeatureFlags {
  // For now, just return the default flags
  // In a real app, this might merge defaults with user preferences or server config
  return {
    ...defaultFeatureFlags,
    // You could add environment variable overrides here
    // enableGeneralPractitioner: process.env.ENABLE_GENERAL_PRACTITIONER === 'true',
  };
}

/**
 * Check if a specific feature is enabled
 * @param featureName The name of the feature to check
 */
export function isFeatureEnabled(featureName: keyof FeatureFlags): boolean {
  const flags = getFeatureFlags();
  return flags[featureName];
}

/**
 * Get all enabled user types based on feature flags
 */
export function getEnabledUserTypes(): ('General Practitioner' | 'School Lecture' | 'Raghav')[] {
  const flags = getFeatureFlags();
  const enabledTypes: ('General Practitioner' | 'School Lecture' | 'Raghav')[] = [];
  
  if (flags.enableGeneralPractitioner) enabledTypes.push('General Practitioner');
  if (flags.enableSchoolLecture) enabledTypes.push('School Lecture');
  if (flags.enableRaghav) enabledTypes.push('Raghav');
  
  return enabledTypes;
}
