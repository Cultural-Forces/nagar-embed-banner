import { renderEmbedAlbumBannerPage } from '../pages/embed-album-banner-page';

const root = document.getElementById('app');
if (root === null) {
  throw new Error('#app root element not found');
}

void renderEmbedAlbumBannerPage(root);
