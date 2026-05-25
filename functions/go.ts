type Env = {
  ALBUM_URL?: string;
};

export const onRequest: PagesFunction<Env> = ({ env }) => {
  const target = env.ALBUM_URL;
  if (typeof target !== 'string' || target.length === 0) {
    return new Response('ALBUM_URL is not configured', {
      status: 503,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }

  return new Response(null, {
    status: 302,
    headers: {
      Location: target,
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer-when-downgrade',
    },
  });
};
