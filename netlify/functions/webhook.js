const axios = require('axios'); // axios로 HTTP 요청 보낼 거야.

exports.handler = async (event, context) => {
  console.log('Webhook received:', event.body);

  const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL_TOM;

  // 보낼 메시지 구성
  const message = {
    text: `새로운 웹훅 수신! 데이터: ${event.body}`,
  };

  try {
    // Slack에 POST 요청
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
