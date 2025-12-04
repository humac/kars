export const base64UrlToUint8Array = (value) =>
  Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

export const uint8ArrayToBase64Url = (buffer) =>
  btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

export const prepareCreationOptions = (options) => ({
  ...options,
  challenge: base64UrlToUint8Array(options.challenge),
  user: {
    ...options.user,
    id: base64UrlToUint8Array(options.user.id)
  },
  excludeCredentials: (options.excludeCredentials || []).map((cred) => ({
    ...cred,
    id: base64UrlToUint8Array(cred.id)
  }))
});

export const prepareRequestOptions = (options) => ({
  ...options,
  challenge: base64UrlToUint8Array(options.challenge),
  allowCredentials: (options.allowCredentials || []).map((cred) => ({
    ...cred,
    id: base64UrlToUint8Array(cred.id)
  }))
});
