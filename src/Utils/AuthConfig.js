// src/authConfig.js
export const msalConfig = {
  auth: {
    clientId: '3902d1d3-3609-40ad-a932-cc5d3ac9c23d',
    authority: 'https://login.microsoftonline.com/3985c2d6-ca53-47eb-bab1-163ecf77ee2d',
    redirectUri: 'http://localhost:3000',
  },
  cache: {
    cacheLocation: 'localStorage',
    storeAuthStateInCookie: false,
  },
};

export const loginRequest = {
  scopes: ['User.Read.All'],
};
