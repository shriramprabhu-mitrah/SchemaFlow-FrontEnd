import { ErrorHandler, Injectable } from '@angular/core';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  handleError(error: any): void {
    const chunkFailedMessage = /Loading chunk [\d]+ failed|Failed to fetch dynamically imported module/;

    if (chunkFailedMessage.test(error?.message || '')) {
      // A new deployment has invalidated the old chunk files.
      // Reload the page so the browser fetches the latest build.
      if (typeof window !== 'undefined') {
        const reloadKey = 'chunk_reload_attempted';
        // Prevent infinite reload loops by only retrying once
        if (!sessionStorage.getItem(reloadKey)) {
          sessionStorage.setItem(reloadKey, 'true');
          window.location.reload();
        } else {
          sessionStorage.removeItem(reloadKey);
          console.error('Chunk load failed even after reload:', error);
        }
      }
      return;
    }

    // Default behavior for all other errors
    console.error(error);
  }
}
