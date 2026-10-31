export function openExternalUrl(url: string): void {
  // No 'noopener' feature: with it window.open always returns null, and we
  // could not tell a blocked popup from an opened one. Cut the opener by hand.
  const opened = window.open(url, '_blank');
  if (opened !== null) {
    opened.opener = null;
    return;
  }
  // popup blocked (e.g. sandboxed iframe without allow-popups)
  window.top?.location.assign(url);
}
