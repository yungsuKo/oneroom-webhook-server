export default async (_req, context) => {
  // 웜업: 수신 엔드포인트에 빈 요청 보내기
  await fetch(`${context.site.url}/.netlify/functions/webhook`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}',
  });
  return new Response('ok');
};

// 매일 03:10 KST (UTC+9) = 18:10 UTC
export const config = { schedule: '10 18 * * *' };
