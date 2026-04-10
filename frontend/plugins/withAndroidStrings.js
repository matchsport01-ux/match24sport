// Plugin to add missing Android string resources
// This fixes the error: "Add all the custom string keys from the locale-specific strings.xml files"
const { withStringsXml, AndroidConfig } = require('expo/config-plugins');

const withAndroidStrings = (config) => {
  return withStringsXml(config, (config) => {
    // Add all required strings with English fallback values
    const stringsToAdd = [
      // Common app strings
      { name: 'app_name', value: 'Match Sport 24' },
      { name: 'expo_splash_screen_status_bar_translucent', value: 'true', translatable: 'false' },
      { name: 'expo_system_ui_status_bar_translucent', value: 'true', translatable: 'false' },
      
      // IAP related strings (required by expo-iap)
      { name: 'subscription_monthly_title', value: 'Monthly Subscription' },
      { name: 'subscription_monthly_description', value: 'Full access to Match Sport 24 platform' },
      { name: 'subscription_price', value: '€49.99/month' },
      
      // Common UI strings that might be locale-specific
      { name: 'cancel', value: 'Cancel' },
      { name: 'ok', value: 'OK' },
      { name: 'error', value: 'Error' },
      { name: 'loading', value: 'Loading...' },
      { name: 'retry', value: 'Retry' },
      { name: 'submit', value: 'Submit' },
      { name: 'save', value: 'Save' },
      { name: 'delete', value: 'Delete' },
      { name: 'edit', value: 'Edit' },
      { name: 'close', value: 'Close' },
      { name: 'back', value: 'Back' },
      { name: 'next', value: 'Next' },
      { name: 'done', value: 'Done' },
      { name: 'search', value: 'Search' },
      { name: 'settings', value: 'Settings' },
      { name: 'profile', value: 'Profile' },
      { name: 'home', value: 'Home' },
      { name: 'login', value: 'Login' },
      { name: 'logout', value: 'Logout' },
      { name: 'register', value: 'Register' },
      
      // Sport-related strings
      { name: 'padel', value: 'Padel' },
      { name: 'tennis', value: 'Tennis' },
      { name: 'calcetto', value: 'Calcetto' },
      { name: 'calcio8', value: 'Calcio a 8' },
      
      // Match-related strings
      { name: 'match', value: 'Match' },
      { name: 'matches', value: 'Matches' },
      { name: 'create_match', value: 'Create Match' },
      { name: 'join_match', value: 'Join Match' },
      { name: 'leave_match', value: 'Leave Match' },
      
      // Club-related strings
      { name: 'club', value: 'Club' },
      { name: 'clubs', value: 'Clubs' },
      { name: 'my_club', value: 'My Club' },
      
      // Review-related strings
      { name: 'reviews', value: 'Reviews' },
      { name: 'write_review', value: 'Write a Review' },
      { name: 'rating', value: 'Rating' },
    ];

    // Get existing strings or initialize empty array
    const existingStrings = config.modResults.resources.string || [];
    
    // Add each string if it doesn't already exist
    stringsToAdd.forEach(({ name, value, translatable }) => {
      const exists = existingStrings.some(
        (s) => s.$ && s.$.name === name
      );
      
      if (!exists) {
        const stringEntry = {
          $: { name },
          _: value,
        };
        
        if (translatable === 'false') {
          stringEntry.$.translatable = 'false';
        }
        
        existingStrings.push(stringEntry);
      }
    });

    config.modResults.resources.string = existingStrings;
    
    return config;
  });
};

module.exports = withAndroidStrings;
