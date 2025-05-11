const axios = require('axios'); // axios로 HTTP 요청 보낼 거야.

exports.handler = async (event, context) => {
  console.log('Webhook received:', event.body);

  const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL_ZENDESK;
  const body = JSON.parse(event.body);
  const today = new Date();
  const formattedDate =
    today.getFullYear() +
    '-' +
    String(today.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(today.getDate()).padStart(2, '0');

  // 보낼 메시지 구성
  let message = { text: 'test', mrkdwn: true };
  if (body.event_no == 90027) {
    const info_msg = body.resource.extra_info
      .map((info) => `\t- ${info.ord_item_code} (${info.supplier_code})`)
      .join('\n');
    message.text = `*반품이 신청 되었어요!*

*요청날짜*: ${formattedDate}  
*주문일자*: ${body.resource.payment_date.slice(0, 10)}  
*품목별 주문번호*  
${info_msg}
*주문자명(수령자명)* : ${body.resource.buyer_name}
*연락처* : ${body.resource.buyer_cellphone}
*상품명* : ${body.resource.ordering_product_name}
*반품사유*: ${body.resource.claim_reason}
*주문서URL*: https://oneroommake.cafe24.com/admin/php/shop1/s_new/order_detail.php?order_id=${
      body.resource.order_id
    }&menu_no=78&bIsPinpointSearch=undefined
`;
  } else if (body.resource.event_no == 90028) {
    const info_msg = body.resource.extra_info
      .map((info) => `\t- ${info.ord_item_code} (${info.supplier_code})`)
      .join('\n');
    message.text = `*교환이 신청 되었어요!*

*요청날짜*: ${formattedDate}  
*주문일자*: ${body.resource.payment_date.slice(0, 10)}  
*품목별 주문번호(공급사코드)*  
${info_msg}
*주문자명(수령자명)* : ${body.resource.buyer_name}
*연락처* : ${body.resource.buyer_cellphone}
*상품명* : ${body.resource.ordering_product_name}
*교환사유*: ${body.resource.claim_reason}
*주문서URL*: https://oneroommake.cafe24.com/admin/php/shop1/s_new/order_detail.php?order_id=${
      body.resource.order_id
    }&menu_no=78&bIsPinpointSearch=undefined
`;
  } else {
    return;
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
