const axios = require('axios'); // axios로 HTTP 요청 보낼 거야.
const crypto = require('crypto');
const { getCache, setCache } = require('./utils/cacheUtil');
// 🔽 supplierMap을 객체로 변환
const supplierArray = require('./supplier_name.json');
const supplierMap = supplierArray.reduce((acc, obj) => {
  const [key, value] = Object.entries(obj)[0];
  acc[key] = value;
  return acc;
}, {});

exports.handler = async (event, context) => {
  try {
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
    const reason = body.resource.claim_reason || '미기재';
    const orderUrl = `https://oneroommake.cafe24.com/admin/php/shop1/s_new/order_detail.php?order_id=${body.resource.order_id}&menu_no=78&bIsPinpointSearch=undefined`;
    let info_msg = '';

    // 고유한 요청 ID 생성
    const keyBase = `${body.resource.order_id}-${body.resource.event_code}`;
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
    if (
      body.resource.event_code !== 'return_order_process' &&
      body.resource.event_code !== 'exchange_order_process'
    ) {
      return {
        statusCode: 400,
        body: 'Unhandled event type',
      };
    }

    const eventText =
      body.resource.event_code === 'return_order_process' ? '반품' : '교환';
    const registCate =
      body.resource.event_code === 'return_order_process'
        ? '반품_변심'
        : '교환_불량';

    const slackMessage = {
      text: `*${eventText}이 신청 되었어요!*
  
  *요청날짜*: ${formattedDate}  
  *주문일자*: ${payDate}  
  *품목별 주문번호*
  ${body.resource.extra_info
    .map((info) => {
      const supplierName =
        supplierMap[info.supplier_code] || info.supplier_code;
      return `\t- ${info.ord_item_code} (${supplierName})`;
    })
    .join('\n')}
  *주문자명(수령자명)* : ${requesterName}
  *연락처* : ${requesterCellphone}
  *상품명* : ${productName}
  *${eventText}사유*: ${reason}
  *주문서URL*: ${orderUrl}
  *raw_data* : ${JSON.stringify(body)}
  `,
      mrkdwn: true,
    };

    await axios.post(slackWebhookUrl, slackMessage);
    // fetchAllUsers 호출 (최초 한 번만 불러오도록 바깥에서 호출한 뒤 users 배열로 전달하는 게 이상적입니다)
    const allUsers = await fetchAllUsers({
      zendeskDomain,
      zendeskEmail,
      zendeskToken,
    });

    for (const info of body.resource.extra_info) {
      const itemKey = `${body.resource.order_id}-${info.ord_item_code}-${body.event_no}`;

      if (getCache(itemKey)) {
        console.log(`중복된 품목 요청: ${itemKey}`);
        continue;
      }
      const supplierName =
        supplierMap[info.supplier_code] || info.supplier_code;

      const itemMessage = `*${eventText} 요청 - 단품 기준 티켓*
  
  *주문일자*: ${payDate}
  *주문자명*: ${requesterName}
  *연락처*: ${requesterCellphone}
  *품목 주문번호*: ${info.ord_item_code}
  *공급사명*: ${supplierName}
  *상품명*: ${productName}
  *사유*: ${reason}
  *주문서URL*: ${orderUrl}
  `;

      // 공급사명과 같은 이름을 가진 사용자 검색
      const matchedUser = allUsers.find(
        (user) => user.name && user.name.trim() === supplierName
      );

      // fallback: 없으면 기본 값 사용
      const requester = matchedUser
        ? { name: matchedUser.name, email: matchedUser.email }
        : { name: '이자영', email: 'jenny@floc.kr' };

      // 이 값을 티켓 생성에 사용
      const zendeskPayload = {
        ticket: {
          subject: `[${eventText}] 신규 티켓! 접수 내용 확인 필요`,
          comment: { body: itemMessage },
          requester: requester,
          custom_fields: [
            { id: 9316369427087, value: requesterName }, // 주문자명
            { id: 9315295471247, value: '높음' }, // 우선순위
            { id: 9316413678223, value: formattedDate }, // 요청날짜
            { id: 9316416018063, value: orderUrl }, // 주문서 URL
            { id: 9316388042767, value: `${info.ord_item_code}` }, // 품목
            { id: 9316414895503, value: requesterCellphone },
            { id: 9316400270479, value: registCate }, // 반품/교환 유형
            { id: 9316386931215, value: productName }, // 상품명
          ],
        },
      };

      try {
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

        setCache(itemKey);
      } catch (err) {
        console.error(
          `❌ Zendesk 생성 실패 (${info.ord_item_code}):`,
          err.message
        );
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Slack 메시지 전송 및 Zendesk 다건 처리 완료',
      }),
    };

    // try {
    //   // Slack에 메시지 전송
    //   await axios.post(slackWebhookUrl, message);

    //   const zendeskPayload = {
    //     ticket: {
    //       subject: `요청 - ${body.resource.order_id}`,
    //       comment: { body: message },
    //       requester: {
    //         name: 'CS/이자영',
    //         email: 'jenny@floc.kr',
    //       },
    //       custom_fields: [
    //         { id: 9316369427087, value: requesterName }, // 주문자명
    //         { id: 9315295471247, value: '높음' }, // 우선순위
    //         { id: 9316413678223, value: formattedDate }, // 요청날짜
    //         { id: 9316416018063, value: orderUrl }, // 주문서URL
    //         { id: 9316388042767, value: info_msg }, // 품목별 주문번호
    //         { id: 9316414895503, value: requesterCellphone }, //
    //         { id: 9316400270479, value: registCate }, // CS접수유형
    //       ],
    //     },
    //   };

    //   await retry(() =>
    //     axios.post(
    //       `https://${zendeskDomain}/api/v2/tickets.json`,
    //       zendeskPayload,
    //       {
    //         headers: {
    //           Authorization:
    //             'Basic ' +
    //             Buffer.from(`${zendeskEmail}/token:${zendeskToken}`).toString(
    //               'base64'
    //             ),
    //           'Content-Type': 'application/json',
    //         },
    //       }
    //     )
    //   );

    //   // 캐시 저장
    //   setCache(uniqueKey);

    //   return {
    //     statusCode: 200,
    //     body: JSON.stringify({
    //       message: 'Slack notification sent!',
    //     }),
    //   };
    // } catch (error) {
    //   console.error('Error sending to Slack:', error);
    //   return {
    //     statusCode: 500,
    //     body: JSON.stringify({
    //       message: 'Slack error',
    //     }),
    //   };
    // }
  } catch (e) {
    console.log(e);
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

async function fetchAllUsers({ zendeskDomain, zendeskEmail, zendeskToken }) {
  let url = `https://${zendeskDomain}/api/v2/users.json?role=end-user`;
  const users = [];

  try {
    while (url) {
      const response = await axios.get(url, {
        headers: {
          'Content-Type': 'application/json',
          Authorization:
            'Basic ' +
            Buffer.from(`${zendeskEmail}/token:${zendeskToken}`).toString(
              'base64'
            ),
        },
      });

      users.push(...response.data.users); // 전개 연산자로 개별 추가
      console.log(`Fetched ${response.data.users.length} users from ${url}`);

      url = response.data.next_page || null;
    }

    console.log(`✅ Total users fetched: ${users.length}`);
    return users;
  } catch (error) {
    console.error(
      '❌ Error fetching users:',
      error.response?.data || error.message
    );
    return [];
  }
}
