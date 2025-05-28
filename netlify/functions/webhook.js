const axios = require('axios'); // axios로 HTTP 요청 보낼 거야.
const crypto = require('crypto');
const { getCache, setCache } = require('./utils/cacheUtil');

exports.handler = async (event, context) => {
  console.log('Webhook received:', event.body);
  const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL_ZENDESK;
  const zendeskDomain = process.env.ZENDESK_DOMAIN;
  const zendeskEmail = process.env.ZENDESK_EMAIL;
  const zendeskToken = process.env.ZENDESK_API_TOKEN;

  const body = JSON.parse(event.body);
  const today = new Date();
  const formattedDate =
    today.getFullYear() +
    '-' +
    String(today.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(today.getDate()).padStart(2, '0');
  const requesterName = body.resource.buyer_name || '고객';
  const requesterCellphone = body.resource.buyer_cellphone || '01000000000';
  const payDate = body.resource.payment_date.slice(0, 10);
  const productName = body.resource.ordering_product_name || '누락';
  const reason = body.resource.claim_reason || '누락';
  const orderUrl = `https://oneroommake.cafe24.com/admin/php/shop1/s_new/order_detail.php?order_id=${body.resource.order_id}&menu_no=78&bIsPinpointSearch=undefined`;
  let registCate = '';
  let info_msg = '';

  // 고유한 요청 ID 생성
  const keyBase = `${body.resource.order_id}-${body.event_no}`;
  const uniqueKey = crypto.createHash('md5').update(keyBase).digest('hex');

  // 중복 체크
  if (getCache(uniqueKey)) {
    console.log('중복된 요청입니다.');
    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Duplicate webhook. Skipped.' }),
    };
  }

  // 보낼 메시지 구성
  let message = { text: 'test', mrkdwn: true };
  if (body.event_no == 90027) {
    registCate = '반품_변심';
    info_msg = body.resource.extra_info
      .map((info) => `\t- ${info.ord_item_code} (${info.supplier_code})`)
      .join('\n');
    message.text = `*반품이 신청 되었어요!*

*요청날짜*: ${formattedDate}  
*주문일자*: ${payDate}  
*품목별 주문번호*  
${info_msg}
*주문자명(수령자명)* : ${requesterName}
*연락처* : ${requesterCellphone}
*상품명* : ${productName}
*반품사유*: ${reason}
*주문서URL*: ${orderUrl}
`;
  } else if (body.resource.event_no == 90028) {
    registCate = '교환_불량';
    info_msg = body.resource.extra_info
      .map((info) => `\t- ${info.ord_item_code} (${info.supplier_code})`)
      .join('\n');
    message.text = `*교환이 신청 되었어요!*

*요청날짜*: ${formattedDate}  
*주문일자*: ${payDate}  
*품목별 주문번호(공급사코드)*  
${info_msg}
*주문자명(수령자명)* : ${requesterName}
*연락처* : ${requesterCellphone}
*상품명* : ${productName}
*교환사유*: ${reason}
*주문서URL*: ${orderUrl}
`;
  } else {
    return;
  }

  try {
    // Slack에 메시지 전송
    await axios.post(slackWebhookUrl, message);

    const zendeskPayload = {
      ticket: {
        subject: `요청 - ${body.resource.order_id}`,
        comment: { body: message },
        requester: {
          name: 'CS/이자영',
          email: 'jenny@floc.kr',
        },
        custom_fields: [
          { id: 9316369427087, value: requesterName }, // 주문자명
          { id: 9315295471247, value: '높음' }, // 우선순위
          { id: 9316413678223, value: formattedDate }, // 요청날짜
          { id: 9316416018063, value: orderUrl }, // 주문서URL
          { id: 9316388042767, value: info_msg }, // 품목별 주문번호
          { id: 9316414895503, value: requesterCellphone }, //
          { id: 9316400270479, value: registCate }, // CS접수유형
        ],
      },
    };

    await retry(() =>
      axios.post(
        `https://${zendeskDomain}/api/v2/tickets.json`,
        zendeskPayload,
        {
          headers: {
            Authorization:
              'Basic ' +
              Buffer.from(`${zendeskEmail}/token:${zendeskToken}`).toString(
                'base64'
              ),
            'Content-Type': 'application/json',
          },
        }
      )
    );

    // 캐시 저장
    setCache(uniqueKey);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Slack notification sent!',
      }),
    };
  } catch (error) {
    console.error('Error sending to Slack:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Slack error',
      }),
    };
  }
};

// retry 함수 정의
async function retry(fn, retries = 3, delay = 1000) {
  let lastErr;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      console.warn(`Retry ${i + 1}/${retries} 실패. 재시도 중...`);
      await new Promise((res) => setTimeout(res, delay));
    }
  }
  throw lastErr;
}
