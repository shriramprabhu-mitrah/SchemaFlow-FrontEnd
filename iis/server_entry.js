// Set allowed hosts so Angular SSR accepts requests from local network IP addresses
process.env.ALLOWED_HOSTS = process.env.ALLOWED_HOSTS || '*';
process.env.NG_ALLOWED_HOSTS = process.env.NG_ALLOWED_HOSTS || '*';

async function startServer() {
  const { reqHandler } = await import('./server/server.mjs');

  const port = process.env.PORT || 4000;

  // reqHandler is an Express app exported from Angular SSR build
  if (typeof reqHandler.listen === 'function') {
    reqHandler.listen(port, () => {
      console.log(`Angular SSR server listening on ${port}`);
    });
  } else {
    console.error('reqHandler does not have a listen method. Check the Angular SSR build output.');
    process.exit(1);
  }
}

startServer().catch(err => {
  console.error('Failed to start Angular SSR server:', err);
  process.exit(1);
});
