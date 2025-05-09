const axios = require('axios'); // axios로 HTTP 요청 보낼 거야.

exports.handler = async (event, context) => {
  console.log('Webhook received:', event.body);

  const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL_ZENDESK;

  // 보낼 메시지 구성
  let message = { text: 'test' };
  if (event.body.event_no == 90027) {
    let info_msg = event.body.extra_info.map(
      (info) => `    - ${info.ord_item_code} (${info.supplier_code}) \n`
    );
    message.text = `반품이 신청 되었어요.\n
    \n
    - 주문번호 : ${event.body.order_id} \n
    - 주문일자 : ${event.body.payment_date.slice(0, 10)} \n
    - 반품 품목
    ${info_msg}
    - 반품사유 : ${event.body.claim_reason} \n
    
    `;
  } else if (event.body.event_no == 90028) {
    let info_msg = event.body.extra_info.map(
      (info) => `    - ${info.ord_item_code} (${info.supplier_code}) \n`
    );
    message.text = `교환이 신청 되었어요.\n
    \n
    - 주문번호 : ${event.body.order_id} \n
    - 주문일자 : ${event.body.payment_date.slice(0, 10)} \n
    - 교환 품목
    ${info_msg}
    - 교환사유 : ${event.body.claim_reason} \n
    `;
  }

  try {
    // Slack에 POST 요청
    console.log(message);
    await axios.post(slackWebhookUrl, message);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Webhook received and Slack notification sent!',
      }),
    };
  } catch (error) {
    console.error('Error sending to Slack:', error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Webhook received but failed to send Slack notification.',
      }),
    };
  }
};
