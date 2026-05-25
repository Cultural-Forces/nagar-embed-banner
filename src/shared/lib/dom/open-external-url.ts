export function openExternalUrl(url: string): void {
  const opened = window.open(url, '_blank', 'noopener,noreferrer');
  if (opened === null) {
    window.top?.location.assign(url);
  }
}
