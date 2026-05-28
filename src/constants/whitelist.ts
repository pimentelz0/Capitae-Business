/**
 * List of user emails that have permanent "Pro" access to all features.
 * Add emails to this list to grant them full access.
 */
export const PRO_WHITELIST = [
  'josueamorim906@gmail.com',
  'ruanvictordacostademedeiros@gmail.com',
  'mvitor8585@gmail.com',
  'caiogabriel1995@gmail.com',
  'karolgoncallo@gmail.com',
  'cabrallohan74@gmail.com',
];

export const isWhitelisted = (email: string | undefined): boolean => {
  if (!email) return false;
  return PRO_WHITELIST.includes(email.toLowerCase());
};
