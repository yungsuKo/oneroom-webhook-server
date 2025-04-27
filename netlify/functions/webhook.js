exports.handler = async (event, context) => {
  console.log('Webhook received:', event.body);

  // 원하는 로직을 여기에 작성 (ex: 데이터 저장, 알림 보내기 등)

  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Webhook received successfully!' }),
  };
};
